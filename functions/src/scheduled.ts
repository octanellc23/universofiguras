import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';

import { COL, db } from './firebase';
import { releaseReservation } from './inventory';

/**
 * Red de seguridad de las reservas (I4).
 *
 * No sustituye al webhook `checkout.session.expired`: lo respalda. Si Stripe no
 * nos avisa, o el webhook falla sus reintentos, el inventario igual tiene que
 * volver al catálogo. Con una o dos unidades por figura, una reserva zombi es
 * literalmente perder la venta.
 */
export const releaseExpiredReservations = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'America/New_York' },
  async () => {
    const now = Timestamp.now();

    const snap = await db
      .collection(COL.reservations)
      .where('status', '==', 'active')
      .where('expiresAt', '<=', now)
      .limit(100)
      .get();

    if (snap.empty) return;

    let released = 0;
    for (const doc of snap.docs) {
      try {
        const didRelease = await releaseReservation(doc.id, 'expired');
        if (!didRelease) continue;
        released++;

        const orderRef = db.collection(COL.orders).doc(doc.id);
        const orderSnap = await orderRef.get();
        if (orderSnap.exists && orderSnap.get('status') === 'pending_payment') {
          await orderRef.update({
            status: 'expired',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (error) {
        // Una reserva atascada no debe frenar las otras 99.
        logger.error('no se pudo liberar la reserva', { orderId: doc.id, error });
      }
    }

    logger.info('reservas vencidas liberadas', { encontradas: snap.size, liberadas: released });
  }
);
