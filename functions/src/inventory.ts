import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { COL, db } from './firebase';
import type {
  LedgerType,
  ProductDoc,
  ReleaseReason,
  ReservationDoc,
  ReservationItem,
} from './types';

/**
 * Inventario. Tres campos derivados que solo se tocan aquí, siempre dentro de
 * una transacción y siempre leyendo todo antes de escribir nada (I13):
 *
 *   stock     unidades físicas en poder del dueño
 *   reserved  comprometidas en checkouts vivos
 *   available stock - reserved  (lo que el catálogo puede vender)
 *
 * La regla que ordena todo lo demás: `reserved` sube al crear la sesión (I4),
 * `stock` solo baja cuando el dinero entró (I3).
 */

/** Une líneas repetidas del mismo producto: dos updates al mismo doc rompen la transacción. */
function mergeItems(items: ReservationItem[]): ReservationItem[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.qty);
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

interface LedgerEntry {
  productId: string;
  type: LedgerType;
  qty: number;
  stockAfter: number;
  reservedAfter: number;
  orderId: string | null;
  actor: string;
  note: string | null;
}

function ledgerRef() {
  return db.collection(COL.inventoryLedger).doc();
}

function ledgerData(entry: LedgerEntry) {
  return { ...entry, createdAt: FieldValue.serverTimestamp() };
}

/**
 * Reserva stock y crea `reservations/{orderId}`. Se llama ANTES de crear la
 * sesión de Stripe: no mandamos a nadie a pagar algo que no podemos apartar.
 *
 * Este es el punto exacto donde se evita la sobreventa cuando publica un video
 * y entran 200 personas en 5 minutos sobre 3 unidades.
 */
export async function reserveStock(params: {
  orderId: string;
  items: ReservationItem[];
  expiresAt: Timestamp;
}): Promise<void> {
  const items = mergeItems(params.items);

  await db.runTransaction(async (tx) => {
    const refs = items.map((item) => db.collection(COL.products).doc(item.productId));

    // --- TODAS las lecturas primero (I13) ---
    const snaps = await tx.getAll(...refs);

    const updates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      product: ProductDoc;
      qty: number;
      reservedAfter: number;
      availableAfter: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const snap = snaps[i];
      const product = snap.data() as ProductDoc | undefined;

      if (!snap.exists || !product || product.status !== 'active') {
        throw new HttpsError(
          'not-found',
          'Uno de los productos de tu carrito ya no está disponible.'
        );
      }

      if (product.available < item.qty) {
        // Mensaje entendible por un comprador, no jerga técnica.
        throw new HttpsError(
          'failed-precondition',
          product.available <= 0
            ? `"${product.title}" se agotó.`
            : `Solo ${product.available === 1 ? 'queda 1' : `quedan ${product.available}`} de "${product.title}".`
        );
      }

      updates.push({
        ref: refs[i],
        product,
        qty: item.qty,
        reservedAfter: product.reserved + item.qty,
        availableAfter: product.available - item.qty,
      });
    }

    // --- y recién ahora las escrituras ---
    for (const update of updates) {
      tx.update(update.ref, {
        reserved: update.reservedAfter,
        available: update.availableAfter,
        inStock: update.availableAfter > 0,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.create(
        ledgerRef(),
        ledgerData({
          productId: update.ref.id,
          type: 'reserve',
          qty: update.qty,
          stockAfter: update.product.stock,
          reservedAfter: update.reservedAfter,
          orderId: params.orderId,
          actor: 'system',
          note: null,
        })
      );
    }

    const reservation: Omit<ReservationDoc, 'createdAt'> & {
      createdAt: FieldValue;
    } = {
      orderId: params.orderId,
      sessionId: null,
      status: 'active',
      items,
      expiresAt: params.expiresAt,
      releaseReason: null,
      createdAt: FieldValue.serverTimestamp(),
      consumedAt: null,
      releasedAt: null,
    };

    tx.create(db.collection(COL.reservations).doc(params.orderId), reservation);
  });
}

/**
 * Devuelve el stock al catálogo. Idempotente: si la reserva ya no está activa
 * no hace nada, porque tanto el webhook `checkout.session.expired` como el
 * barrido programado pueden llegar a la misma reserva.
 */
export async function releaseReservation(
  orderId: string,
  reason: ReleaseReason
): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const reservationRef = db.collection(COL.reservations).doc(orderId);

    // --- lecturas ---
    const reservationSnap = await tx.get(reservationRef);
    const reservation = reservationSnap.data() as ReservationDoc | undefined;

    if (!reservation || reservation.status !== 'active') {
      return false;
    }

    const refs = reservation.items.map((item) =>
      db.collection(COL.products).doc(item.productId)
    );
    const snaps = await tx.getAll(...refs);

    // --- escrituras ---
    for (let i = 0; i < reservation.items.length; i++) {
      const item = reservation.items[i];
      const product = snaps[i].data() as ProductDoc | undefined;
      if (!product) continue; // producto borrado: no hay nada que devolver

      const reservedAfter = Math.max(0, product.reserved - item.qty);
      const availableAfter = product.stock - reservedAfter;

      tx.update(refs[i], {
        reserved: reservedAfter,
        available: availableAfter,
        inStock: availableAfter > 0,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.create(
        ledgerRef(),
        ledgerData({
          productId: refs[i].id,
          type: 'release',
          qty: item.qty,
          stockAfter: product.stock,
          reservedAfter,
          orderId,
          actor: reason === 'expired' ? 'scheduler' : 'webhook',
          note: reason,
        })
      );
    }

    tx.update(reservationRef, {
      status: 'released',
      releaseReason: reason,
      releasedAt: FieldValue.serverTimestamp(),
    });

    return true;
  });
}

/**
 * Convierte la reserva en venta: baja `stock` y `reserved`. `available` no se
 * mueve, porque ya se había descontado al reservar.
 *
 * Se llama SOLO desde checkout.session.completed (I3).
 */
export async function consumeReservation(orderId: string): Promise<{
  consumed: boolean;
  oversold: boolean;
}> {
  return db.runTransaction(async (tx) => {
    const reservationRef = db.collection(COL.reservations).doc(orderId);

    // --- lecturas ---
    const reservationSnap = await tx.get(reservationRef);
    const reservation = reservationSnap.data() as ReservationDoc | undefined;

    if (!reservation || reservation.status === 'consumed') {
      // Ya se procesó (reintento de Stripe que se coló pese a stripeEvents), o
      // nunca existió. En ninguno de los dos casos hay que descontar de nuevo.
      return { consumed: false, oversold: false };
    }

    // Caso incómodo pero real: la reserva venció y el comprador pagó igual
    // (Stripe puede completar una sesión en el límite del minuto 30). El dinero
    // ya entró, así que la venta se registra sí o sí; lo que hacemos es tomar
    // las unidades del pool disponible y avisar si ya no estaban.
    const wasReleased = reservation.status === 'released';

    const refs = reservation.items.map((item) =>
      db.collection(COL.products).doc(item.productId)
    );
    const snaps = await tx.getAll(...refs);

    let oversold = false;
    const updates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      qty: number;
      stockAfter: number;
      reservedAfter: number;
      availableAfter: number;
    }> = [];

    for (let i = 0; i < reservation.items.length; i++) {
      const item = reservation.items[i];
      const product = snaps[i].data() as ProductDoc | undefined;
      if (!product) {
        oversold = true;
        continue;
      }

      const stockAfter = product.stock - item.qty;
      const reservedAfter = wasReleased
        ? product.reserved
        : Math.max(0, product.reserved - item.qty);
      const availableAfter = stockAfter - reservedAfter;

      if (stockAfter < 0 || availableAfter < 0) {
        oversold = true;
      }

      updates.push({
        ref: refs[i],
        qty: item.qty,
        stockAfter,
        reservedAfter,
        availableAfter,
      });
    }

    // --- escrituras ---
    for (const update of updates) {
      tx.update(update.ref, {
        stock: update.stockAfter,
        reserved: update.reservedAfter,
        available: update.availableAfter,
        inStock: update.availableAfter > 0,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.create(
        ledgerRef(),
        ledgerData({
          productId: update.ref.id,
          type: 'sale',
          qty: update.qty,
          stockAfter: update.stockAfter,
          reservedAfter: update.reservedAfter,
          orderId,
          actor: 'webhook',
          note: wasReleased ? 'pago recibido después de vencer la reserva' : null,
        })
      );
    }

    tx.update(reservationRef, {
      status: 'consumed',
      consumedAt: FieldValue.serverTimestamp(),
    });

    return { consumed: true, oversold };
  });
}

/**
 * Reposición y correcciones manuales. Existe porque las reglas de Firestore le
 * prohíben al panel de admin tocar stock/available directamente: si el dueño
 * sube `stock` a mano desde el navegador, `available` queda desfasado y se
 * sobrevende.
 */
export async function adjustStock(params: {
  productId: string;
  delta: number;
  actorUid: string;
  note: string | null;
  type: Extract<LedgerType, 'restock' | 'adjust'>;
}): Promise<{ stock: number; available: number }> {
  return db.runTransaction(async (tx) => {
    const ref = db.collection(COL.products).doc(params.productId);

    const snap = await tx.get(ref);
    const product = snap.data() as ProductDoc | undefined;
    if (!product) {
      throw new HttpsError('not-found', 'Ese producto no existe.');
    }

    const stockAfter = product.stock + params.delta;
    if (stockAfter < product.reserved) {
      throw new HttpsError(
        'failed-precondition',
        `No puedes dejar el stock en ${stockAfter}: hay ${product.reserved} unidad(es) apartadas en compras en curso.`
      );
    }

    const availableAfter = stockAfter - product.reserved;

    tx.update(ref, {
      stock: stockAfter,
      available: availableAfter,
      inStock: availableAfter > 0,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.create(
      ledgerRef(),
      ledgerData({
        productId: params.productId,
        type: params.type,
        qty: Math.abs(params.delta),
        stockAfter,
        reservedAfter: product.reserved,
        orderId: null,
        actor: `admin:${params.actorUid}`,
        note: params.note,
      })
    );

    logger.info('inventario ajustado', {
      productId: params.productId,
      delta: params.delta,
      stockAfter,
    });

    return { stock: stockAfter, available: availableAfter };
  });
}
