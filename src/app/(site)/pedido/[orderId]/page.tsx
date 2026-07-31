import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCents } from '@/lib/money';
import { getOrder } from '@/lib/server/catalog';
import { ClearCart } from './ClearCart';

// Un pedido indexado sería una filtración: lleva nombre, correo y dirección.
export const metadata = { title: 'Tu pedido', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await getOrder(orderId);
  if (!order) notFound();

  // El pago lo confirma el webhook, no esta página. Entre que Stripe redirige
  // y el webhook procesa pueden pasar un par de segundos, y el comprador no
  // tiene por qué ver eso como un error.
  const confirmed = order.status !== 'pending_payment';

  return (
    <div className="shell">
      <div className="confirm">
        <ClearCart />

        <div className="confirm__mark">{confirmed ? '✓' : '⋯'}</div>
        <h1 style={{ fontSize: 30 }}>
          {confirmed ? '¡Gracias por tu compra!' : 'Estamos confirmando tu pago'}
        </h1>
        <div className="confirm__number">{order.number}</div>

        <p style={{ color: 'var(--text-muted)', marginTop: 18 }}>
          {confirmed
            ? order.customerEmail
              ? `Te escribimos a ${order.customerEmail} en cuanto salga el paquete.`
              : 'Te escribimos en cuanto salga el paquete.'
            : 'Esto toma unos segundos. Puedes recargar la página.'}
        </p>

        <div className="panel">
          {order.items.map((item, index) => (
            <div key={index} className="summary__row">
              <span>
                {item.qty} × {item.title}
              </span>
              <span>{formatCents(item.lineTotalCents)}</span>
            </div>
          ))}

          <div className="summary__row">
            <span>Envío</span>
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
        </div>

        <Link href="/" className="btn btn--ghost" style={{ marginTop: 28 }}>
          Seguir viendo figuras
        </Link>
      </div>
    </div>
  );
}
