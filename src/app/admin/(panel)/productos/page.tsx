import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { listAllProducts, type AdminProductRow } from '@/lib/server/admin-catalog';

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

function Tabla({ filas, tipo }: { filas: AdminProductRow[]; tipo: 'figura' | 'print' }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th>{tipo === 'print' ? 'Print' : 'Figura'}</th>
            <th>Estado</th>
            <th>Precio</th>
            <th>A la venta</th>
            <th>Paquete</th>
            {tipo === 'figura' && <th>Video</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((product) => {
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
                {tipo === 'figura' && <td>{product.hasVideo ? '▶' : '—'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function ProductosPage() {
  const todos = await listAllProducts();

  // Dos listas y no una con columna de categoría: son dos negocios distintos
  // y se revisan por separado.
  const figuras = todos.filter((p) => !p.esPrint);
  const prints = todos.filter((p) => p.esPrint);

  const resumen = (filas: AdminProductRow[]) =>
    `${filas.length} en total · ${filas.filter((f) => f.status === 'active').length} publicadas`;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Catálogo</h1>
          <p className="panel__hint">
            {figuras.length} figura(s) · {prints.length} print(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/productos/nuevo" className="btn btn--primary">
            + Nueva figura
          </Link>
          {/* Un print arranca ya configurado: tier de lámina, sin envío
              internacional y en la categoría que lo manda a /prints. */}
          <Link href="/admin/productos/nuevo?tipo=print" className="btn btn--ghost">
            + Nuevo print
          </Link>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 0, padding: 0, border: 0 }}>
        <div className="section__head" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 19 }}>Figuras</h2>
          <span>{resumen(figuras)}</span>
        </div>

        {figuras.length === 0 ? (
          <div className="empty">
            <h2>Todavía no hay figuras</h2>
            <p style={{ marginBottom: 24 }}>Empieza por la última que reseñaste.</p>
            <Link href="/admin/productos/nuevo" className="btn btn--primary">
              Cargar la primera
            </Link>
          </div>
        ) : (
          <Tabla filas={figuras} tipo="figura" />
        )}
      </section>

      <section className="panel" style={{ padding: 0, border: 0, marginTop: 36 }}>
        <div className="section__head" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 19 }}>Prints</h2>
          <span>{resumen(prints)}</span>
        </div>

        {prints.length === 0 ? (
          <div className="empty">
            <h2>Todavía no hay prints</h2>
            <p style={{ marginBottom: 24 }}>Fotografía de colección en papel premium.</p>
            <Link href="/admin/productos/nuevo?tipo=print" className="btn btn--primary">
              Cargar el primero
            </Link>
          </div>
        ) : (
          <Tabla filas={prints} tipo="print" />
        )}
      </section>
    </>
  );
}
