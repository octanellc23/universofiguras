import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCents } from '@/lib/money';
import { getOrderDetail } from '@/lib/server/admin-catalog';
import { ShipForm } from './ShipForm';

export const dynamic = 'force-dynamic';

const MOTIVO: Record<string, string> = {
  high_value: 'Monto alto',
  billing_country_mismatch: 'El país de la tarjeta no coincide con el de entrega',
  oversold: 'Se cobró sin inventario disponible',
  dispute: 'Hay una disputa abierta',
};

function fecha(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const pagado = order.status === 'paid' || order.status === 'fulfilled';

  return (
    <>
      <div className="admin-head">
        <div>
          <Link href="/admin/pedidos" className="admin-back">
            ← Pedidos
          </Link>
          <h1>{order.number}</h1>
          <p className="panel__hint">
            {fecha(order.paidAt ?? order.createdAt)} · {order.email ?? 'sin correo'}
          </p>
        </div>
      </div>

      {order.manualReview && (
        <div className="notice notice--error">
          <strong>Revisar antes de despachar.</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {order.reasons.map((reason) => (
              <li key={reason}>{MOTIVO[reason] ?? reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-grid">
        <div className="admin-col">
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel__title">Qué lleva</h2>
            {order.items.map((item, index) => (
              <div key={index} className="summary__row">
                <span>
                  {item.qty} × {item.title}
                </span>
                <span>{formatCents(item.lineTotalCents)}</span>
              </div>
            ))}
            <div className="summary__row">
              <span>Envío {order.shippingLabel ? `— ${order.shippingLabel}` : ''}</span>
              <span>
                {order.shippingCents === 0 ? 'Gratis' : formatCents(order.shippingCents)}
              </span>
            </div>
            {order.taxCents > 0 && (
              <div className="summary__row">
                <span>Impuestos</span>
                <span>{formatCents(order.taxCents)}</span>
              </div>
            )}
            <div className="summary__row summary__row--total">
              <span>Total</span>
              <span>{formatCents(order.totalCents)}</span>
            </div>
            {order.amountRefundedCents > 0 && (
              <div className="summary__row" style={{ color: 'var(--danger)' }}>
                <span>Reembolsado</span>
                <span>−{formatCents(order.amountRefundedCents)}</span>
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel__title">A dónde va</h2>
            {order.address ? (
              <address style={{ fontStyle: 'normal', lineHeight: 1.7, fontSize: 14.5 }}>
                {order.name && (
                  <>
                    <strong>{order.name}</strong>
                    <br />
                  </>
                )}
                {order.address.line1}
                <br />
                {order.address.line2 && (
                  <>
                    {order.address.line2}
                    <br />
                  </>
                )}
                {order.address.city}, {order.address.state} {order.address.postalCode}
                <br />
                {order.address.country}
                {order.phone && (
                  <>
                    <br />
                    Tel: {order.phone}
                  </>
                )}
              </address>
            ) : (
              <p className="panel__hint">
                Todavía no hay dirección: llega con la confirmación del pago.
              </p>
            )}
          </section>
        </div>

        <div className="admin-col">
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel__title">Despacho</h2>

            {order.signatureRequired && (
              <div className="notice notice--error" style={{ marginBottom: 14 }}>
                <strong>Pide firma en la entrega.</strong> Es un pedido de monto alto, y la firma
                es la prueba que gana una disputa por &quot;no me llegó&quot;.
              </div>
            )}

            {order.consolidateHold && (
              <p className="panel__hint">
                Marcado para esperar y mandar junto con otros pedidos del mismo comprador.
              </p>
            )}

            {order.status === 'fulfilled' && order.trackingUrl && (
              <p className="panel__hint">
                Enviado el {fecha(order.shippedAt)} ·{' '}
                <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="table__link">
                  Ver rastreo ↗
                </a>
              </p>
            )}

            {pagado ? (
              <ShipForm
                orderId={order.id}
                carrier={order.carrier}
                trackingNumber={order.trackingNumber}
                yaEnviado={order.status === 'fulfilled'}
              />
            ) : (
              <p className="panel__hint">
                Este pedido no está pagado, así que no hay nada que despachar.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
