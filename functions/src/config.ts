import { HttpsError } from 'firebase-functions/v2/https';
import { COL, db } from './firebase';
import type { FraudConfig, ShippingConfig, StoreConfig } from './types';

/**
 * Las tarifas viven en Firestore, no en constantes (I10): USPS sube precios en
 * enero y julio y el dueño tiene que poder ajustarlas sin desplegar.
 */
export async function getShippingConfig(): Promise<ShippingConfig> {
  const snap = await db.collection(COL.config).doc('shipping').get();
  const data = snap.data() as ShippingConfig | undefined;

  if (!data || !data.domestic?.tiers?.standard) {
    // Si esto pasa en producción es un problema de configuración, no del
    // comprador: no le damos detalles, pero sí un mensaje que no lo deje
    // pensando que perdió su dinero.
    throw new HttpsError(
      'failed-precondition',
      'La tienda está en mantenimiento. Intenta de nuevo en unos minutos.'
    );
  }

  return data;
}

export async function getStoreConfig(): Promise<StoreConfig> {
  const snap = await db.collection(COL.config).doc('store').get();
  const data = snap.data() as Partial<StoreConfig> | undefined;

  return {
    storeName: data?.storeName ?? 'Universo Figuras',
    supportEmail: data?.supportEmail ?? '',
    // Por defecto ENCENDIDO. Si el documento no existe o alguien borra el
    // campo, se cobra impuesto: equivocarse hacia cobrar de más se corrige con
    // un reembolso, equivocarse hacia no cobrar se paga de su bolsillo.
    automaticTaxEnabled: data?.automaticTaxEnabled ?? true,
  };
}

export async function getFraudConfig(): Promise<FraudConfig> {
  const snap = await db.collection(COL.config).doc('fraud').get();
  const data = snap.data() as Partial<FraudConfig> | undefined;

  // Valores por defecto conservadores: si el documento no existe, pedimos firma
  // sobre $150 igual. Es preferible pedir firma de más que perder un chargeback.
  return {
    signatureRequiredAboveCents: data?.signatureRequiredAboveCents ?? 15000,
    manualReviewAboveCents: data?.manualReviewAboveCents ?? 30000,
    manualReviewIfBillingCountryDiffers:
      data?.manualReviewIfBillingCountryDiffers ?? true,
  };
}
