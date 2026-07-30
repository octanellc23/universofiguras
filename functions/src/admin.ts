import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adjustStock } from './inventory';

/**
 * Reposición de inventario desde el panel.
 *
 * Existe porque las reglas de Firestore le prohíben al navegador —incluso al
 * admin— escribir stock/reserved/available: son campos derivados. Si el dueño
 * editara `stock` a mano, `available` quedaría desfasado y se sobrevendería.
 */
export const adjustStockLevel = onCall(
  async (request): Promise<{ stock: number; available: number }> => {
    if (request.auth?.token?.admin !== true) {
      throw new HttpsError('permission-denied', 'No tienes permiso para hacer esto.');
    }

    const data = request.data as {
      productId?: unknown;
      delta?: unknown;
      note?: unknown;
    };

    const productId = typeof data.productId === 'string' ? data.productId.trim() : '';
    const delta = typeof data.delta === 'number' ? Math.trunc(data.delta) : Number.NaN;

    if (!productId) {
      throw new HttpsError('invalid-argument', 'Falta el producto.');
    }
    if (!Number.isFinite(delta) || delta === 0) {
      throw new HttpsError(
        'invalid-argument',
        'Indica cuántas unidades agregar (positivo) o quitar (negativo).'
      );
    }

    return adjustStock({
      productId,
      delta,
      actorUid: request.auth.uid,
      note: typeof data.note === 'string' ? data.note : null,
      type: delta > 0 ? 'restock' : 'adjust',
    });
  }
);
