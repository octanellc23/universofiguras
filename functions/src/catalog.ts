import { HttpsError } from 'firebase-functions/v2/https';
import { COL, db } from './firebase';
import type { CartLineInput, ProductDoc, QuoteItem } from './types';

const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 10;

/**
 * Valida lo poco que el navegador tiene permitido mandar: identificadores,
 * cantidades y un país (I1). Nada de precios, nada de costos de envío.
 */
export function parseCartInput(raw: unknown): {
  lines: CartLineInput[];
  country: string;
} {
  const data = raw as { items?: unknown; country?: unknown } | undefined;

  if (!Array.isArray(data?.items) || data.items.length === 0) {
    throw new HttpsError('invalid-argument', 'Tu carrito está vacío.');
  }
  if (data.items.length > MAX_LINES) {
    throw new HttpsError('invalid-argument', 'Tu carrito tiene demasiados artículos distintos.');
  }

  const country = typeof data.country === 'string' ? data.country.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new HttpsError('invalid-argument', 'Elige el país de entrega para calcular el envío.');
  }

  const lines: CartLineInput[] = data.items.map((entry) => {
    const line = entry as { productId?: unknown; qty?: unknown };
    const productId = typeof line.productId === 'string' ? line.productId.trim() : '';
    const qty = typeof line.qty === 'number' ? Math.floor(line.qty) : 0;

    if (!productId || productId.includes('/')) {
      throw new HttpsError('invalid-argument', 'Hay un artículo inválido en tu carrito.');
    }
    if (qty < 1 || qty > MAX_QTY_PER_LINE) {
      throw new HttpsError('invalid-argument', 'La cantidad de algún artículo no es válida.');
    }

    return { productId, qty };
  });

  return { lines, country };
}

/**
 * Resuelve las líneas del carrito contra Firestore. TODO lo que va al precio
 * final sale de aquí, del servidor: precio unitario, tier de envío,
 * elegibilidades e impuesto (I1).
 */
export async function loadQuoteItems(lines: CartLineInput[]): Promise<QuoteItem[]> {
  // Dos líneas del mismo producto serían dos escrituras al mismo documento en
  // la transacción de reserva; las unimos desde ya.
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty);
  }

  const entries = [...merged];
  const refs = entries.map(([productId]) => db.collection(COL.products).doc(productId));
  const snaps = await db.getAll(...refs);

  return entries.map(([productId, qty], index) => {
    const snap = snaps[index];
    const product = snap.data() as ProductDoc | undefined;

    if (!snap.exists || !product || product.status !== 'active') {
      // Nada de "actualiza la página": el carrito vive en el navegador, así que
      // recargar no lo arregla y deja al comprador dando vueltas.
      throw new HttpsError(
        'not-found',
        'Uno de los productos de tu carrito ya no está disponible.'
      );
    }

    return {
      productId,
      slug: product.slug,
      title: product.title,
      imageUrl: product.images?.[0]?.url ?? null,
      unitPriceCents: product.priceCents,
      qty,
      lineTotalCents: product.priceCents * qty,
      available: product.available,
      taxCode: product.taxCode,
      tier: product.shipping.tier,
      weightGrams: product.shipping.weightGrams,
      // Un artículo 'heavy' nunca sale del país, diga lo que diga la bandera.
      internationalEligible:
        product.shipping.internationalEligible && product.shipping.tier !== 'heavy',
      freeShippingEligible: product.shipping.freeShippingEligible,
      localPickupEligible: product.shipping.localPickupEligible,
      consolidateHold: product.fulfillment?.consolidateHold ?? false,
      handlingDays: product.fulfillment?.handlingDays ?? 2,
    };
  });
}
