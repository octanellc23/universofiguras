/**
 * El dueño es un revendedor: lo normal son 1 o 2 unidades por figura. Decir
 * "Última unidad" no es un truco de urgencia, es el inventario real.
 *
 * Y hay un estado que importa distinguir: cuando `available` llega a 0 porque
 * alguien tiene la figura apartada en un pago a medio hacer, la figura NO está
 * agotada — vuelve en 30 minutos si esa compra no se completa. Decir "Agotado"
 * ahí pierde la visita para siempre; decir la verdad la retiene.
 */
export function StockBadge({
  available,
  stock,
  reserved,
}: {
  available: number;
  stock: number;
  reserved: number;
}) {
  if (available > 0) {
    if (available <= 2) {
      return (
        <span className="badge badge--low">
          {available === 1 ? 'Última unidad' : `Últimas ${available}`}
        </span>
      );
    }
    return <span className="badge badge--stock">Disponible</span>;
  }

  if (stock > 0 && reserved > 0) {
    return <span className="badge badge--held">Alguien la está comprando</span>;
  }

  return <span className="badge badge--out">Agotado</span>;
}
