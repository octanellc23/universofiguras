import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import type Stripe from 'stripe';

import { getFraudConfig } from './config';
import { COL, db } from './firebase';
import { consumeReservation, releaseReservation } from './inventory';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, stripe } from './stripe';

/**
 * Webhook de Stripe.
 *
 * DOS COSAS QUE NO SE TOCAN:
 *
 * 1. Se usa `req.rawBody` y NO hay body parser (I6). Cualquier express.json()
 *    o middleware que toque el cuerpo destruye la verificación de firma,
 *    porque la firma se calcula sobre los bytes exactos que mandó Stripe.
 *
 * 2. La idempotencia va por `event.id` con `.create()`, no `.set()` (I5).
 *    Stripe reintenta durante tres días; sin esto, un reintento descuenta
 *    inventario dos veces.
 */
export const stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    cors: false,
    // El webhook lo llama Stripe, no un navegador autenticado.
    invoker: 'public',
  },
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      res.status(400).send('falta la cabecera stripe-signature');
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(
        req.rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (error) {
      // Firma inválida: 400 y no reintentar. O es un error de configuración
      // del secreto, o alguien está tocando la puerta.
      logger.error('firma de webhook inválida', { error });
      res.status(400).send('firma inválida');
      return;
    }

    const eventRef = db.collection(COL.stripeEvents).doc(event.id);

    try {
      // .create() falla si el documento existe, y esa falla ES la señal de
      // "ya procesé este evento".
      await eventRef.create({
        type: event.type,
        status: 'processing',
        orderId: null,
        livemode: event.livemode,
        stripeCreatedAt: Timestamp.fromMillis(event.created * 1000),
        receivedAt: FieldValue.serverTimestamp(),
        processedAt: null,
        error: null,
        // TTL a 90 días: Stripe deja de reintentar a los 3, el resto es holgura
        // para depurar sin guardar basura para siempre.
        expireAt: Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
    } catch {
      logger.info('evento duplicado, ya procesado', { eventId: event.id, type: event.type });
      res.status(200).send('duplicado');
      return;
    }

    try {
      const orderId = await handleEvent(event);
      await eventRef.update({
        status: 'done',
        orderId: orderId ?? null,
        processedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('ok');
    } catch (error) {
      // Borramos el marcador para que el reintento de Stripe SÍ pueda
      // reprocesar. Si lo dejáramos, el .create() del reintento fallaría, lo
      // leeríamos como duplicado y el evento se perdería para siempre. El
      // rastro del fallo queda en los logs.
      logger.error('error procesando webhook', {
        eventId: event.id,
        type: event.type,
        error,
      });
      await eventRef.delete().catch(() => undefined);
      res.status(500).send('error interno');
    }
  }
);

async function handleEvent(event: Stripe.Event): Promise<string | null> {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCompleted(event.data.object);
    case 'checkout.session.expired':
      return handleExpired(event.data.object);
    case 'charge.refunded':
      return handleRefund(event.data.object);
    case 'charge.dispute.created':
      return handleDispute(event.data.object);
    default:
      logger.debug('evento ignorado', { type: event.type });
      return null;
  }
}

/** Aquí, y solo aquí, baja el stock (I3). */
async function handleCompleted(session: Stripe.Checkout.Session): Promise<string | null> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) {
    logger.error('sesión completada sin orderId', { sessionId: session.id });
    return null;
  }

  // Con métodos de pago asíncronos la sesión puede completarse sin dinero
  // confirmado. Sin dinero no se descuenta inventario.
  if (session.payment_status === 'unpaid') {
    logger.info('sesión completada pero aún sin pago', { orderId });
    return orderId;
  }

  const { oversold } = await consumeReservation(orderId);

  const orderRef = db.collection(COL.orders).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    logger.error('pago recibido de una orden inexistente', { orderId, sessionId: session.id });
    return orderId;
  }

  const fraud = await getFraudConfig();
  const shipping = extractShippingDetails(session);
  const billingCountry = session.customer_details?.address?.country ?? null;
  const shippingCountry = shipping?.address?.country ?? null;
  const totalCents = session.amount_total ?? 0;

  const reasons: string[] = [];
  if (totalCents > fraud.manualReviewAboveCents) {
    reasons.push('high_value');
  }
  // Coleccionable caro + tarjeta de un país + dirección de envío de otro es el
  // patrón clásico de reenvío. Se marca para que el dueño lo mire; NO se
  // bloquea: su público es justamente internacional.
  if (
    fraud.manualReviewIfBillingCountryDiffers &&
    billingCountry &&
    shippingCountry &&
    billingCountry !== shippingCountry
  ) {
    reasons.push('billing_country_mismatch');
  }
  if (oversold) {
    reasons.push('oversold');
  }

  const update: Record<string, unknown> = {
    status: 'paid',
    // Los montos autoritativos son los que Stripe realmente cobró, no nuestra
    // proyección: el comprador pudo elegir recogido en persona en vez de envío.
    subtotalCents: session.amount_subtotal ?? 0,
    shippingCents: session.total_details?.amount_shipping ?? 0,
    taxCents: session.total_details?.amount_tax ?? 0,
    discountCents: session.total_details?.amount_discount ?? 0,
    totalCents,
    customer: {
      email: session.customer_details?.email ?? null,
      name: session.customer_details?.name ?? shipping?.name ?? null,
      phone: session.customer_details?.phone ?? null,
    },
    shippingAddress: shipping?.address
      ? {
          line1: shipping.address.line1 ?? null,
          line2: shipping.address.line2 ?? null,
          city: shipping.address.city ?? null,
          state: shipping.address.state ?? null,
          postalCode: shipping.address.postal_code ?? null,
          country: shipping.address.country ?? null,
        }
      : null,
    billingCountry,
    'stripe.paymentIntentId':
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    signatureRequired: totalCents > fraud.signatureRequiredAboveCents,
    'flags.manualReview': reasons.length > 0,
    'flags.oversold': oversold,
    paidAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  // arrayUnion() sin argumentos lanza; solo agregamos el campo si hay motivos.
  if (reasons.length > 0) {
    update['flags.reasons'] = FieldValue.arrayUnion(...reasons);
  }

  await orderRef.update(update);

  if (oversold) {
    // Pagó y no había unidades. El dinero ya entró, así que esto lo resuelve
    // una persona: reponer o reembolsar.
    logger.error('SOBREVENTA: pago cobrado sin inventario disponible', { orderId });
  }

  return orderId;
}

/** La sesión venció sin pago: el inventario vuelve al catálogo. */
async function handleExpired(session: Stripe.Checkout.Session): Promise<string | null> {
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return null;

  await releaseReservation(orderId, 'stripe_expired');

  const orderRef = db.collection(COL.orders).doc(orderId);
  const snap = await orderRef.get();
  if (snap.exists && snap.get('status') === 'pending_payment') {
    await orderRef.update({
      status: 'expired',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return orderId;
}

async function handleRefund(charge: Stripe.Charge): Promise<string | null> {
  const order = await findOrderByCharge(charge);
  if (!order) return null;

  const total = order.get('totalCents') as number;
  const refunded = charge.amount_refunded;

  // El reembolso NO repone stock automáticamente: la figura puede volver
  // dañada, o no volver nunca. Eso lo decide el dueño con adjustStock.
  await order.ref.update({
    status: refunded >= total ? 'refunded' : 'partially_refunded',
    amountRefundedCents: refunded,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return order.id;
}

async function handleDispute(dispute: Stripe.Dispute): Promise<string | null> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
  const snap = await db
    .collection(COL.orders)
    .where('stripe.paymentIntentId', '==', dispute.payment_intent)
    .limit(1)
    .get();

  if (snap.empty) {
    logger.warn('disputa sin orden asociada', { chargeId });
    return null;
  }

  const order = snap.docs[0];
  await order.ref.update({
    'flags.disputed': true,
    'flags.manualReview': true,
    'flags.reasons': FieldValue.arrayUnion('dispute'),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.error('DISPUTA abierta', { orderId: order.id, reason: dispute.reason });
  return order.id;
}

async function findOrderByCharge(
  charge: Stripe.Charge
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  if (!paymentIntentId) return null;

  const snap = await db
    .collection(COL.orders)
    .where('stripe.paymentIntentId', '==', paymentIntentId)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0];
}

interface ShippingDetails {
  name?: string | null;
  address?: Stripe.Address | null;
}

/**
 * Cast puntual de tipos de Stripe: la dirección de envío se movió de
 * `session.shipping_details` a `session.collected_information.shipping_details`
 * en versiones recientes de la API. Leemos la nueva y caemos a la vieja para
 * no depender de qué versión tenga activa la cuenta.
 */
function extractShippingDetails(session: Stripe.Checkout.Session): ShippingDetails | null {
  const raw = session as unknown as {
    collected_information?: { shipping_details?: ShippingDetails | null } | null;
    shipping_details?: ShippingDetails | null;
  };
  return raw.collected_information?.shipping_details ?? raw.shipping_details ?? null;
}
