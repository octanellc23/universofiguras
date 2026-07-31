import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { listAllProducts } from '@/lib/server/admin-catalog';

export const metadata = { title: 'Figuras' };
export const dynamic = 'force-dynamic';

const ESTADO: Record<string, { texto: string; clase: string }> = {
  active: { texto: 'Publicada', clase: 'badge--stock' },
  draft: { texto: 'Borrador', clase: 'badge--low' },
  archived: { texto: 'Archivada', clase: 'badge--out' },
};

const TAMANO: Record<string, string> = {
  print: 'Lámina',
  standard: 'Mediana',
  large: 'Grande',
  heavy: 'Pesada',
};

export default async function ProductosPage() {
  const products = await listAllProducts();

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Figuras</h1>
          <p className="panel__hint">
            {products.length} en total · {products.filter((p) => p.status === 'active').length}{' '}
            publicadas
          </p>
        </div>
        <Link href="/admin/productos/nuevo" className="btn btn--primary">
          + Nueva figura
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="empty">
          <h2>Todavía no hay figuras</h2>
          <p style={{ marginBottom: 24 }}>Empieza por la última que reseñaste.</p>
          <Link href="/admin/productos/nuevo" className="btn btn--primary">
            Cargar la primera
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>Figura</th>
                <th>Estado</th>
                <th>Precio</th>
                <th>A la venta</th>
                <th>Paquete</th>
                <th>Video</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const estado = ESTADO[product.status] ?? ESTADO.draft;
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="table__thumb">
                        {product.imageUrl && <img src={product.imageUrl} alt="" />}
                      </div>
                    </td>
                    <td>
                      <Link href={`/admin/productos/${product.id}`} className="table__link">
                        {product.title}
                      </Link>
                      <div className="table__sub">/{product.slug}</div>
                    </td>
                    <td>
                      <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                    </td>
                    <td className="table__num">{formatCents(product.priceCents)}</td>
                    <td className="table__num">
                      {product.available}
                      {product.reserved > 0 && (
                        <span className="table__sub"> ({product.reserved} apartadas)</span>
                      )}
                    </td>
                    <td>{TAMANO[product.tier] ?? product.tier}</td>
                    <td>{product.hasVideo ? '▶' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
