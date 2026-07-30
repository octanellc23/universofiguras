import './options';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();

export const COL = {
  products: 'products',
  orders: 'orders',
  reservations: 'reservations',
  inventoryLedger: 'inventoryLedger',
  stripeEvents: 'stripeEvents',
  config: 'config',
} as const;
