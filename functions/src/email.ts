import { defineSecret, defineString } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';

export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

/**
 * Remitente. Tiene que estar en el dominio verificado en Resend, o los correos
 * salen pero nadie los recibe.
 */
export const EMAIL_FROM = defineString('EMAIL_FROM', {
  default: 'Universo Figuras <pedidos@universofiguras.com>',
});

export const SITE = defineString('SITE_URL', { default: 'https://universofiguras.com' });

interface Envio {
  para: string;
  asunto: string;
  html: string;
  responderA?: string;
}

/**
 * Manda un correo. NUNCA lanza: un fallo de correo no puede tumbar el webhook
 * que descuenta inventario. Devuelve si salió, y el detalle queda en el log.
 */
export async function enviarCorreo(envio: Envio): Promise<boolean> {
  const key = RESEND_API_KEY.value();
  if (!key || key.startsWith('PENDIENTE')) {
    logger.warn('correo no enviado: falta configurar RESEND_API_KEY', { asunto: envio.asunto });
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM.value(),
        to: [envio.para],
        subject: envio.asunto,
        html: envio.html,
        ...(envio.responderA ? { reply_to: envio.responderA } : {}),
      }),
    });

    if (!res.ok) {
      logger.error('Resend rechazó el correo', {
        status: res.status,
        detalle: await res.text(),
        asunto: envio.asunto,
      });
      return false;
    }
    return true;
  } catch (error) {
    logger.error('no se pudo contactar a Resend', { error, asunto: envio.asunto });
    return false;
  }
}

// --- plantillas -------------------------------------------------------

const dinero = (centavos: number): string => `$${((centavos ?? 0) / 100).toFixed(2)}`;

export interface DatosCorreo {
  numero: string;
  orderId: string;
  items: Array<{ title: string; qty: number; lineTotalCents: number }>;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  nombre: string | null;
  direccion: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  metodoEnvio: string | null;
  diasDespacho: number;
  firmaRequerida: boolean;
  transportista?: string | null;
  rastreo?: string | null;
  urlRastreo?: string | null;
}

/**
 * HTML de correo: tablas y estilos en línea, fondo claro.
 *
 * Los clientes de correo no entienden CSS moderno ni respetan el modo oscuro
 * de forma predecible; lo que se ve bien en el navegador se rompe en Outlook.
 * Por eso esto no se parece al sitio: se parece a un correo que llega bien.
 */
function envoltura(titulo: string, cuerpo: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <tr><td style="background:#0b0a0e;padding:22px 26px;">
    <img src="${SITE.value()}/logo.png" alt="Lokillo's Hidden Gems" width="150" style="display:block;border:0;">
  </td></tr>
  <tr><td style="padding:28px 26px 8px;">
    <h1 style="margin:0 0 6px;font-size:21px;color:#18181b;">${titulo}</h1>
  </td></tr>
  ${cuerpo}
  <tr><td style="padding:22px 26px 28px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12.5px;line-height:1.6;">
    Cualquier duda, responde a este correo.<br>
    <a href="${SITE.value()}" style="color:#ff5a1f;">universofiguras.com</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function tablaArticulos(datos: DatosCorreo): string {
  const filas = datos.items
    .map(
      (item) => `<tr>
      <td style="padding:7px 0;color:#3f3f46;font-size:14px;">${item.qty} × ${item.title}</td>
      <td style="padding:7px 0;text-align:right;color:#3f3f46;font-size:14px;white-space:nowrap;">${dinero(item.lineTotalCents)}</td>
    </tr>`
    )
    .join('');

  const impuesto =
    datos.taxCents > 0
      ? `<tr><td style="padding:4px 0;color:#71717a;font-size:14px;">Impuestos</td>
         <td style="padding:4px 0;text-align:right;color:#71717a;font-size:14px;">${dinero(datos.taxCents)}</td></tr>`
      : '';

  return `<tr><td style="padding:12px 26px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${filas}
      <tr><td colspan="2" style="border-top:1px solid #e4e4e7;height:12px;"></td></tr>
      <tr><td style="padding:4px 0;color:#71717a;font-size:14px;">Subtotal</td>
          <td style="padding:4px 0;text-align:right;color:#71717a;font-size:14px;">${dinero(datos.subtotalCents)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;font-size:14px;">Envío</td>
          <td style="padding:4px 0;text-align:right;color:#71717a;font-size:14px;">${datos.shippingCents === 0 ? 'Gratis' : dinero(datos.shippingCents)}</td></tr>
      ${impuesto}
      <tr><td style="padding:10px 0 0;color:#18181b;font-size:16px;font-weight:700;">Total</td>
          <td style="padding:10px 0 0;text-align:right;color:#18181b;font-size:16px;font-weight:700;">${dinero(datos.totalCents)}</td></tr>
    </table>
  </td></tr>`;
}

function bloqueDireccion(datos: DatosCorreo): string {
  if (!datos.direccion) return '';
  const d = datos.direccion;
  return `<tr><td style="padding:22px 26px 0;">
    <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Va a</p>
    <p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.6;">
      ${datos.nombre ? `${datos.nombre}<br>` : ''}
      ${d.line1 ?? ''}${d.line2 ? `<br>${d.line2}` : ''}<br>
      ${d.city ?? ''}, ${d.state ?? ''} ${d.postalCode ?? ''}<br>${d.country ?? ''}
    </p>
  </td></tr>`;
}

export function correoConfirmacion(datos: DatosCorreo): { asunto: string; html: string } {
  const firma = datos.firmaRequerida
    ? `<tr><td style="padding:18px 26px 0;">
        <p style="margin:0;padding:12px 14px;background:#fef3c7;border-radius:8px;color:#78350f;font-size:13.5px;line-height:1.55;">
          Por el valor del pedido, la entrega <strong>requiere firma</strong>. Asegúrate de que
          haya alguien para recibirlo.
        </p>
      </td></tr>`
    : '';

  const cuerpo = `
    <tr><td style="padding:0 26px;">
      <p style="margin:0;color:#52525b;font-size:14.5px;line-height:1.6;">
        Recibimos tu pedido <strong style="color:#18181b;">${datos.numero}</strong>. Lo preparamos
        y sale en ${datos.diasDespacho} ${datos.diasDespacho === 1 ? 'día hábil' : 'días hábiles'};
        te avisamos con el número de rastreo en cuanto lo despachemos.
      </p>
    </td></tr>
    ${tablaArticulos(datos)}
    ${bloqueDireccion(datos)}
    ${firma}
    <tr><td style="padding:22px 26px 0;">
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">
        Recuerda que nuestras figuras se abren para reseñarlas en video, salvo que la ficha
        indique que están selladas.
      </p>
    </td></tr>
    <tr><td style="padding:20px 26px 0;">
      <a href="${SITE.value()}/pedido/${datos.orderId}"
         style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14.5px;font-weight:600;">
        Ver mi pedido
      </a>
    </td></tr>`;

  return { asunto: `Pedido ${datos.numero} confirmado`, html: envoltura('¡Gracias por tu compra!', cuerpo) };
}

export function correoEnviado(datos: DatosCorreo): { asunto: string; html: string } {
  const boton = datos.urlRastreo
    ? `<tr><td style="padding:20px 26px 0;">
        <a href="${datos.urlRastreo}"
           style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14.5px;font-weight:600;">
          Seguir mi paquete
        </a>
      </td></tr>`
    : '';

  const cuerpo = `
    <tr><td style="padding:0 26px;">
      <p style="margin:0;color:#52525b;font-size:14.5px;line-height:1.6;">
        Tu pedido <strong style="color:#18181b;">${datos.numero}</strong> salió hoy por
        <strong>${datos.transportista ?? 'el correo'}</strong>.
      </p>
    </td></tr>
    <tr><td style="padding:18px 26px 0;">
      <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Número de rastreo</p>
      <p style="margin:0;color:#18181b;font-size:17px;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.02em;">
        ${datos.rastreo ?? '—'}
      </p>
    </td></tr>
    ${boton}
    ${bloqueDireccion(datos)}
    ${tablaArticulos(datos)}
    <tr><td style="padding:20px 26px 0;">
      <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6;">
        El rastreo puede tardar unas horas en mostrar movimiento: el transportista lo activa
        cuando escanea el paquete.
      </p>
    </td></tr>`;

  return { asunto: `Tu pedido ${datos.numero} va en camino`, html: envoltura('Tu paquete salió', cuerpo) };
}
