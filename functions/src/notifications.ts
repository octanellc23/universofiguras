import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';

import { getStoreConfig } from './config';
import { correoEnviado, enviarCorreo, RESEND_API_KEY, type DatosCorreo } from './email';

/**
 * Aviso de "tu paquete salió", con el número de rastreo.
 *
 * Va como disparador de Firestore y no dentro del panel a propósito: se manda
 * cuando el pedido pasa a enviado, sin importar quién lo marcó ni desde dónde.
 * Y la clave del proveedor de correo vive en un solo sitio, las funciones.
 */
export const notificarEnvio = onDocumentUpdated(
  { document: 'orders/{orderId}', secrets: [RESEND_API_KEY] },
  async (event) => {
    const datosEvento = event.data;
    if (!datosEvento) return;

    const antes = datosEvento.before.data();
    const despues = datosEvento.after.data();
    if (!antes || !despues) return;

    // Solo en la transición a enviado, y una sola vez. Esta función se
    // dispara con cada escritura del pedido —incluida la suya propia al
    // marcar el correo como enviado— así que sin esta guarda se manda en
    // bucle.
    const recienEnviado = antes.status !== 'fulfilled' && despues.status === 'fulfilled';
    if (!recienEnviado || despues.emails?.shippedSentAt) return;

    const correo = despues.customer?.email;
    if (!correo) {
      logger.warn('pedido enviado sin correo del comprador', { orderId: event.params.orderId });
      return;
    }

    const store = await getStoreConfig();

    const datos: DatosCorreo = {
      numero: despues.number,
      orderId: event.params.orderId,
      items: despues.items ?? [],
      subtotalCents: despues.subtotalCents ?? 0,
      shippingCents: despues.shippingCents ?? 0,
      taxCents: despues.taxCents ?? 0,
      totalCents: despues.totalCents ?? 0,
      nombre: despues.customer?.name ?? null,
      direccion: despues.shippingAddress ?? null,
      metodoEnvio: despues.shippingQuote?.rateLabel ?? null,
      diasDespacho: 2,
      firmaRequerida: despues.signatureRequired ?? false,
      transportista: despues.fulfillment?.carrier ?? null,
      rastreo: despues.fulfillment?.trackingNumber ?? null,
      urlRastreo: despues.fulfillment?.trackingUrl ?? null,
    };

    const { asunto, html } = correoEnviado(datos);
    const enviado = await enviarCorreo({
      para: correo,
      asunto,
      html,
      responderA: store.supportEmail || undefined,
    });

    // Se marca aunque haya fallado: sin esto, cualquier edición posterior del
    // pedido volvería a intentarlo. El fallo queda en el log.
    await datosEvento.after.ref.update({
      'emails.shippedSentAt': FieldValue.serverTimestamp(),
      'emails.shippedOk': enviado,
    });

    logger.info('aviso de envío', { orderId: event.params.orderId, enviado });
  }
);
