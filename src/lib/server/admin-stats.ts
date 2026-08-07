import { adminDb } from './admin';

/**
 * Resumen de ventas por mes.
 *
 * Cuenta solo lo cobrado: un pedido sin `paidAt` nunca movió dinero. Y resta
 * los reembolsos, porque una venta devuelta no es una venta — mostrarla como
 * ingreso es la forma más fácil de que alguien tome una decisión con un número
 * que no existe.
 */

/** La zona del negocio: una venta de las 8pm del día 31 es de ese mes, no del siguiente. */
const ZONA = 'America/New_York';

export interface MesVentas {
  clave: string;
  etiqueta: string;
  pedidos: number;
  unidades: number;
  brutoCents: number;
  envioCents: number;
  impuestoCents: number;
  reembolsadoCents: number;
  netoCents: number;
}

export interface ProductoVendido {
  title: string;
  unidades: number;
  ingresoCents: number;
}

export interface ResumenVentas {
  meses: MesVentas[];
  topProductos: ProductoVendido[];
  totalPedidos: number;
  netoTotalCents: number;
  ticketPromedioCents: number;
  sinDespachar: number;
}

const formateadorMes = new Intl.DateTimeFormat('es', {
  month: 'long',
  year: 'numeric',
  timeZone: ZONA,
});

function claveMes(fecha: Date): string {
  // en-CA da ISO (2026-08-05), del que solo queremos año y mes.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: ZONA,
  })
    .format(fecha)
    .slice(0, 7);
}

export async function resumenVentas(maxPedidos = 500): Promise<ResumenVentas> {
  // orderBy por paidAt: los que nunca se pagaron tienen null y quedan al
  // final; se descartan al recorrer.
  const snap = await adminDb
    .collection('orders')
    .orderBy('paidAt', 'desc')
    .limit(maxPedidos)
    .get();

  const meses = new Map<string, MesVentas>();
  const productos = new Map<string, ProductoVendido>();
  let totalPedidos = 0;
  let netoTotalCents = 0;
  let sinDespachar = 0;

  for (const doc of snap.docs) {
    const pagado = doc.get('paidAt');
    if (!pagado?.toDate) continue;

    const fecha = pagado.toDate() as Date;
    const clave = claveMes(fecha);

    const total = (doc.get('totalCents') as number) ?? 0;
    const reembolsado = (doc.get('amountRefundedCents') as number) ?? 0;
    const neto = total - reembolsado;
    const items = (doc.get('items') ?? []) as Array<{
      title: string;
      qty: number;
      lineTotalCents: number;
    }>;
    const unidades = items.reduce((n, item) => n + (item.qty ?? 0), 0);

    const mes = meses.get(clave) ?? {
      clave,
      etiqueta: formateadorMes.format(fecha),
      pedidos: 0,
      unidades: 0,
      brutoCents: 0,
      envioCents: 0,
      impuestoCents: 0,
      reembolsadoCents: 0,
      netoCents: 0,
    };

    mes.pedidos += 1;
    mes.unidades += unidades;
    mes.brutoCents += total;
    mes.envioCents += (doc.get('shippingCents') as number) ?? 0;
    mes.impuestoCents += (doc.get('taxCents') as number) ?? 0;
    mes.reembolsadoCents += reembolsado;
    mes.netoCents += neto;
    meses.set(clave, mes);

    totalPedidos += 1;
    netoTotalCents += neto;
    if (doc.get('status') === 'paid') sinDespachar += 1;

    for (const item of items) {
      const actual = productos.get(item.title) ?? {
        title: item.title,
        unidades: 0,
        ingresoCents: 0,
      };
      actual.unidades += item.qty ?? 0;
      actual.ingresoCents += item.lineTotalCents ?? 0;
      productos.set(item.title, actual);
    }
  }

  return {
    meses: [...meses.values()].sort((a, b) => b.clave.localeCompare(a.clave)),
    topProductos: [...productos.values()]
      .sort((a, b) => b.ingresoCents - a.ingresoCents)
      .slice(0, 8),
    totalPedidos,
    netoTotalCents,
    ticketPromedioCents: totalPedidos > 0 ? Math.round(netoTotalCents / totalPedidos) : 0,
    sinDespachar,
  };
}
