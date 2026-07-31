import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { listAllProducts, listOrders } from '@/lib/server/admin-catalog';

export const metadata = { title: 'Resumen' };
export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const [products, orders] = await Promise.all([listAllProducts(), listOrders(20)]);

  const publicadas = products.filter((product) => product.status === 'active');
  const agotadas = publicadas.filter((product) => product.available <= 0);
  const porDespachar = orders.filter((order) => order.status === 'paid');
  const revisar = orders.filter((order) => order.manualReview && order.status === 'paid');

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Panel</h1>
          <p className="panel__hint">Lo que necesita tu atención hoy.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/productos/nuevo" className="btn btn--primary">
            + Nueva figura
          </Link>
          <Link href="/admin/productos/nuevo?tipo=print" className="btn btn--ghost">
            + Nuevo print
          </Link>
        </div>
      </div>

      <div className="stat-row">
        <Link href="/admin/pedidos" className="stat">
          <span className="stat__num">{porDespachar.length}</span>
          <span className="stat__label">por despachar</span>
        </Link>
        <Link href="/admin/productos" className="stat">
          <span className="stat__num">{publicadas.length}</span>
          <span className="stat__label">figuras publicadas</span>
        </Link>
        <Link href="/admin/productos" className="stat">
          <span className="stat__num">{agotadas.length}</span>
          <span className="stat__label">agotadas</span>
        </Link>
        <div className="stat">
          <span className="stat__num">
            {formatCents(
              orders
                .filter((order) => order.status === 'paid' || order.status === 'fulfilled')
                .reduce((sum, order) => sum + order.totalCents, 0)
            )}
          </span>
          <span className="stat__label">vendido (últimos pedidos)</span>
        </div>
      </div>

      {revisar.length > 0 && (
        <div className="notice notice--error" style={{ marginTop: 24 }}>
          {revisar.length} pedido(s) marcados para revisar a mano antes de despachar.{' '}
          <Link href="/admin/pedidos" style={{ textDecoration: 'underline' }}>
            Verlos
          </Link>
        </div>
      )}

      {agotadas.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">Agotadas y todavía publicadas</h2>
          <p className="panel__hint">
            La ficha sigue viva porque el video sigue mandando gente, pero no se puede comprar.
            Si te llegan más unidades, repónlas desde la figura.
          </p>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18 }}>
            {agotadas.map((product) => (
              <li key={product.id} style={{ marginBottom: 6 }}>
                <Link href={`/admin/productos/${product.id}`} className="table__link">
                  {product.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
