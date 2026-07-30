/**
 * El dueño es un revendedor: lo normal son 1 o 2 unidades por figura. Decir
 * "Última 1" no es un truco de urgencia, es el inventario real.
 */
export function StockBadge({ available }: { available: number }) {
  if (available <= 0) {
    return <span className="badge badge--out">Agotado</span>;
  }
  if (available <= 2) {
    return (
      <span className="badge badge--low">
        {available === 1 ? 'Última unidad' : `Últimas ${available}`}
      </span>
    );
  }
  return <span className="badge badge--stock">Disponible</span>;
}
