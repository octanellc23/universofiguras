import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { resumenVentas } from '@/lib/server/admin-stats';

export const metadata = { title: 'Ventas' };
export const dynamic = 'force-dynamic';

export default async function VentasPage() {
  const resumen = await resumenVentas();
  const mesActual = resumen.meses[0];
  const mesAnterior = resumen.meses[1];

  // Comparar contra el mes pasado es lo único que convierte un número en una
  // noticia: $400 no dice nada, "$400, el doble que el mes pasado" sí.
  const variacion =
    mesActual && mesAnterior && mesAnterior.netoCents > 0
      ? Math.round(((mesActual.netoCents - mesAnterior.netoCents) / mesAnterior.netoCents) * 100)
      : null;

  const maximo = Math.max(1, ...resumen.meses.map((m) => m.netoCents));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Ventas</h1>
          <p className="panel__hint">
            Solo lo cobrado, con los reembolsos ya restados.
          </p>
        </div>
      </div>

      {resumen.totalPedidos === 0 ? (
        <div className="empty">
          <h2>Todavía no hay ventas</h2>
          <p>Aquí van a aparecer en cuanto entre el primer pago.</p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="stat__num">
                {mesActual ? formatCents(mesActual.netoCents) : formatCents(0)}
              </span>
              <span className="stat__label">
                {mesActual ? mesActual.etiqueta : 'este mes'}
                {variacion !== null && (
                  <span
                    style={{
                      marginLeft: 6,
                      color: variacion >= 0 ? 'var(--success)' : 'var(--danger)',
                    }}
                  >
                    {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion)}%
                  </span>
                )}
              </span>
            </div>

            <div className="stat">
              <span className="stat__num">{mesActual?.pedidos ?? 0}</span>
              <span className="stat__label">pedidos este mes</span>
            </div>

            <div className="stat">
              <span className="stat__num">{formatCents(resumen.ticketPromedioCents)}</span>
              <span className="stat__label">promedio por pedido</span>
            </div>

            <Link href="/admin/pedidos" className="stat">
              <span className="stat__num">{resumen.sinDespachar}</span>
              <span className="stat__label">pagados sin despachar</span>
            </Link>
          </div>

          <section className="panel">
            <h2 className="panel__title">Mes a mes</h2>
            <p className="panel__hint">Neto: lo cobrado menos lo reembolsado.</p>

            <div className="barras">
              {resumen.meses.map((mes) => (
                <div key={mes.clave} className="barra">
                  <span className="barra__mes">{mes.etiqueta}</span>
                  <div className="barra__pista">
                    <div
                      className="barra__valor"
                      style={{ width: `${Math.max(2, (mes.netoCents / maximo) * 100)}%` }}
                    />
                  </div>
                  <span className="barra__monto">{formatCents(mes.netoCents)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">Detalle por mes</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Pedidos</th>
                    <th>Unidades</th>
                    <th>Cobrado</th>
                    <th>Envío</th>
                    <th>Impuesto</th>
                    <th>Reembolsos</th>
                    <th>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.meses.map((mes) => (
                    <tr key={mes.clave}>
                      <td>{mes.etiqueta}</td>
                      <td className="table__num">{mes.pedidos}</td>
                      <td className="table__num">{mes.unidades}</td>
                      <td className="table__num">{formatCents(mes.brutoCents)}</td>
                      <td className="table__num">{formatCents(mes.envioCents)}</td>
                      <td className="table__num">
                        {mes.impuestoCents === 0 ? (
                          <span style={{ color: 'var(--warning)' }}>—</span>
                        ) : (
                          formatCents(mes.impuestoCents)
                        )}
                      </td>
                      <td className="table__num">
                        {mes.reembolsadoCents === 0
                          ? '—'
                          : `−${formatCents(mes.reembolsadoCents)}`}
                      </td>
                      <td className="table__num">
                        <strong>{formatCents(mes.netoCents)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="panel__hint" style={{ marginTop: 14, marginBottom: 0 }}>
              La columna de impuesto en guion significa que no se cobró ninguno. Mientras el
              registro de Connecticut no esté cargado en Stripe, va a seguir así.
            </p>
          </section>

          <section className="panel">
            <h2 className="panel__title">Lo que más se vende</h2>
            <p className="panel__hint">
              Por dinero, no por unidades: vender diez láminas de $18 no es lo mismo que dos
              figuras de $90.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidades</th>
                    <th>Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.topProductos.map((producto) => (
                    <tr key={producto.title}>
                      <td>{producto.title}</td>
                      <td className="table__num">{producto.unidades}</td>
                      <td className="table__num">{formatCents(producto.ingresoCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
