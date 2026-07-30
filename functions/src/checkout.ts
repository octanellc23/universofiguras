import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import type Stripe from 'stripe';

import { loadQuoteItems, parseCartInput } from './catalog';
import { getFraudConfig, getShippingConfig, getStoreConfig } from './config';
import { COL, db } from './firebase';
import { releaseReservation, reserveStock } from './inventory';
import { buildShippingOptions, subtotalCents, totalUnits } from './shipping';
import { SITE_URL, STRIPE_SECRET_KEY, stripe } from './stripe';
import type { CartQuote, QuoteItem, ShippingOption } from './types';

/**
 * Número visible para humanos. NO usamos un contador en un documento único:
 * con 200 compradores simultáneos ese documento se vuelve el cuello de botella
 * del checkout (Firestore serializa las escrituras al mismo doc).
 */
function orderNumber(orderId: string): string {
  return `UF-${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
}

/**
 * Cotizador del carrito. Usa exactamente la misma función de envío que
 * createCheckout (I9): si estos dos números difieren aunque sea en un centavo,
 * el comprador ve un precio en el carrito y otro en Stripe.
 */
export const quoteCart = onCall(async (request): Promise<CartQuote> => {
  const { lines, country } = parseCartInput(request.data);
  const [items, config] = await Promise.all([loadQuoteItems(lines), getShippingConfig()]);

  return {
    items,
    subtotalCents: subtotalCents(items),
    units: totalUnits(items),
    country,
    options: buildShippingOptions(items, country, config),
    ratesVersion: config.version,
  };
});

export const createCheckout = onCall(
  { secrets: [STRIPE_SECRET_KEY] },
  async (request): Promise<{ orderId: string; url: string; expiresAt: number }> => {
    const { lines, country } = parseCartInput(request.data);
    const email = readEmail(request.data);

    const [items, shippingConfig, fraudConfig, storeConfig] = await Promise.all([
      loadQuoteItems(lines),
      getShippingConfig(),
      getFraudConfig(),
      getStoreConfig(),
    ]);

    const taxEnabled = storeConfig.automaticTaxEnabled;
    if (!taxEnabled) {
      // Que quede en el log de cada compra: es un estado de desarrollo, no una
      // configuración normal de una tienda que vende.
      logger.warn('Stripe Tax DESACTIVADO: esta orden no calcula impuesto', {
        orderIdPendiente: true,
      });
    }

    // El país ya viene elegido desde nuestro sitio porque Stripe no nos deja
    // recalcular el envío cuando el comprador escribe su dirección (I7).
    const options = buildShippingOptions(items, country, shippingConfig);

    // El navegador solo puede decir CUÁL de las opciones eligió, nunca cuánto
    // cuesta (I1). Si manda una que no calculamos nosotros, se ignora.
    const requestedId = readShippingOptionId(request.data);
    const delivery = options.find((option) => option.id === requestedId) ?? options[0];

    const subtotal = subtotalCents(items);
    const projectedTotal = subtotal + delivery.amountCents;

    const orderRef = db.collection(COL.orders).doc();
    const orderId = orderRef.id;

    // 30 minutos es el mínimo que Stripe acepta en expires_at. La reserva vive
    // 2 minutos más para no soltar inventario mientras Stripe todavía procesa
    // un pago que entró en el segundo 29:58.
    const ttlMinutes = shippingConfig.reservationTtlMinutes || 30;
    const expiresAtMs = Date.now() + ttlMinutes * 60_000;

    // Reservamos ANTES de crear la sesión: no mandamos a nadie a pagar algo que
    // no podemos apartar (I4). Si no alcanza, esto lanza con un mensaje que el
    // comprador entiende ("Solo quedan 2 de ...").
    await reserveStock({
      orderId,
      items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
      expiresAt: Timestamp.fromMillis(expiresAtMs + 2 * 60_000),
    });

    await orderRef.set({
      number: orderNumber(orderId),
      status: 'pending_payment',
      items: items.map((item) => ({
        productId: item.productId,
        slug: item.slug,
        title: item.title,
        imageUrl: item.imageUrl,
        unitPriceCents: item.unitPriceCents,
        qty: item.qty,
        lineTotalCents: item.lineTotalCents,
        shippingTier: item.tier,
        weightGrams: item.weightGrams,
      })),
      subtotalCents: subtotal,
      shippingCents: delivery.amountCents,
      taxCents: 0, // lo llena el webhook: lo calcula Stripe Tax
      discountCents: 0,
      totalCents: projectedTotal, // proyección; el webhook graba lo realmente cobrado
      amountRefundedCents: 0,
      currency: 'usd',
      shippingQuote: {
        method: delivery.method,
        country: delivery.country,
        bandId: delivery.bandId,
        tier: delivery.tier,
        units: delivery.units,
        baseCents: delivery.baseCents,
        additionalItemCents: delivery.additionalItemCents,
        freeShippingApplied: delivery.freeShippingApplied,
        rateLabel: delivery.label,
        ratesVersion: delivery.ratesVersion,
      },
      pickupOffered: options.some((option) => option.method === 'pickup'),
      customer: { email: email ?? null, name: null, phone: null },
      shippingAddress: null,
      billingCountry: null,
      stripe: {
        sessionId: null,
        paymentIntentId: null,
        expiresAt: Timestamp.fromMillis(expiresAtMs),
        hostedUrl: null,
      },
      // Queda grabado en la orden: si algún día hay ventas sin impuesto, se
      // pueden encontrar filtrando por este campo.
      automaticTaxEnabled: taxEnabled,
      signatureRequired: projectedTotal > fraudConfig.signatureRequiredAboveCents,
      flags: { manualReview: false, oversold: false, disputed: false, reasons: [] },
      consolidateHold: items.some((item) => item.consolidateHold),
      fulfillment: {
        carrier: null,
        trackingNumber: null,
        trackingUrl: null,
        shippedAt: null,
        deliveredAt: null,
        notes: null,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      paidAt: null,
      processedEventIds: [],
    });

    try {
      const session = await stripe().checkout.sessions.create(
        {
          mode: 'payment',
          client_reference_id: orderId,
          metadata: { orderId },
          locale: 'auto',
          ...(email ? { customer_email: email } : {}),
          line_items: items.map((item) => toLineItem(item, taxEnabled)),
          // Stripe Tax. En Connecticut el envío ES gravable cuando el artículo
          // lo es, y eso se resuelve con el tax_code de la shipping rate.
          automatic_tax: { enabled: taxEnabled },
          shipping_address_collection: {
            // Un solo país: el que ya cotizamos. Si pudiera cambiarlo aquí
            // dentro, pagaría un envío que no corresponde (I7).
            allowed_countries: [country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry],
          },
          // Solo la opción que el comprador ya eligió en el carrito. Mandar
          // varias haría que el total de Stripe pudiera diferir del que vio.
          shipping_options: [toShippingOption(delivery, shippingConfig.shippingTaxCode, taxEnabled)],
          // DHL exige teléfono para despachar internacional.
          phone_number_collection: { enabled: delivery.method === 'international' },
          expires_at: Math.floor(expiresAtMs / 1000),
          payment_intent_data: {
            metadata: { orderId },
            description: `Universo Figuras ${orderNumber(orderId)}`,
          },
          success_url: `${SITE_URL.value()}/pedido/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${SITE_URL.value()}/carrito`,
        },
        { idempotencyKey: `checkout_${orderId}` }
      );

      if (!session.url) {
        throw new Error('Stripe no devolvió URL de checkout');
      }

      await orderRef.update({
        'stripe.sessionId': session.id,
        'stripe.hostedUrl': session.url,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection(COL.reservations).doc(orderId).update({ sessionId: session.id });

      return { orderId, url: session.url, expiresAt: expiresAtMs };
    } catch (error) {
      // Si Stripe falla, el inventario NO se queda apartado esperando 30
      // minutos a que lo suelte el barrido: lo devolvemos ya.
      logger.error('falló la creación de la sesión de Stripe', { orderId, error });
      await releaseReservation(orderId, 'canceled');
      await orderRef.update({
        status: 'canceled',
        updatedAt: FieldValue.serverTimestamp(),
      });

      throw new HttpsError(
        'internal',
        'No pudimos iniciar el pago. No se te cobró nada; intenta de nuevo en un momento.'
      );
    }
  }
);

function readShippingOptionId(raw: unknown): string | null {
  const value = (raw as { shippingOptionId?: unknown } | undefined)?.shippingOptionId;
  return typeof value === 'string' ? value : null;
}

function readEmail(raw: unknown): string | null {
  const value = (raw as { email?: unknown } | undefined)?.email;
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * El precio se arma aquí, con price_data en línea leído de Firestore. No hay
 * catálogo espejo en Stripe que se pueda desincronizar, y el navegador nunca
 * participa (I1).
 */
function toLineItem(
  item: QuoteItem,
  taxEnabled: boolean
): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: item.qty,
    price_data: {
      currency: 'usd',
      unit_amount: item.unitPriceCents,
      // Sin Stripe Tax, mandar tax_behavior/tax_code no aporta nada y solo
      // abre la puerta a un rechazo de validación.
      ...(taxEnabled ? { tax_behavior: 'exclusive' as const } : {}),
      product_data: {
        name: item.title,
        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
        ...(taxEnabled ? { tax_code: item.taxCode } : {}),
        metadata: { productId: item.productId },
      },
    },
  };
}

function toShippingOption(
  option: ShippingOption,
  shippingTaxCode: string,
  taxEnabled: boolean
): Stripe.Checkout.SessionCreateParams.ShippingOption {
  const rate: Stripe.Checkout.SessionCreateParams.ShippingOption.ShippingRateData = {
    type: 'fixed_amount',
    display_name: option.label,
    fixed_amount: { amount: option.amountCents, currency: 'usd' },
    // txcd_92010001: en Connecticut el cargo de envío es gravable cuando el
    // artículo lo es. No es un campo que se exenta.
    ...(taxEnabled
      ? { tax_behavior: 'exclusive' as const, tax_code: shippingTaxCode }
      : {}),
    metadata: { optionId: option.id, ratesVersion: String(option.ratesVersion) },
  };

  if (option.deliveryDays) {
    rate.delivery_estimate = {
      minimum: { unit: 'business_day', value: option.deliveryDays.min },
      maximum: { unit: 'business_day', value: option.deliveryDays.max },
    };
  }

  return { shipping_rate_data: rate };
}
