import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { listOrders } from '@/lib/server/admin-catalog';

export const metadata = { title: 'Pedidos — Panel' };
export const dynamic = 'force-dynamic';

const ESTADO: Record<string, { texto: string; clase: string }> = {
  pending_payment: { texto: 'Sin pagar', clase: 'badge--low' },
  paid: { texto: 'Pagado', clase: 'badge--stock' },
  fulfilled: { texto: 'Enviado', clase: 'badge--stock' },
  expired: { texto: 'Vencido', clase: 'badge--out' },
  canceled: { texto: 'Cancelado', clase: 'badge--out' },
  refunded: { texto: 'Reembolsado', clase: 'badge--out' },
  partially_refunded: { texto: 'Reemb. parcial', clase: 'badge--low' },
};

export default async function PedidosPage() {
  const orders = await listOrders();
  const porPagar = orders.filter((order) => order.status === 'paid');

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Pedidos</h1>
          <p className="panel__hint">
            {porPagar.length} pagado(s) esperando despacho · {orders.length} en total
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <h2>Todavía no hay pedidos</h2>
          <p>Aquí van a aparecer en cuanto alguien compre.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Estado</th>
                <th>Cliente</th>
                <th>Destino</th>
                <th>Artículos</th>
                <th>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/pedidos/${order.id}`} className="table__link">
                      {order.number}
                    </Link>
                    {order.manualReview && (
                      <div className="table__sub" style={{ color: 'var(--warning)' }}>
                        Revisar a mano
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${(ESTADO[order.status] ?? ESTADO.expired).clase}`}>
                      {(ESTADO[order.status] ?? { texto: order.status }).texto}
                    </span>
                  </td>
                  <td>{order.email ?? '—'}</td>
                  <td>{order.country ?? '—'}</td>
                  <td className="table__num">{order.itemCount}</td>
                  <td className="table__num">{formatCents(order.totalCents)}</td>
                  <td className="table__sub">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('es', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </>
  );
}
