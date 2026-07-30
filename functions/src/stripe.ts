import { defineSecret, defineString } from 'firebase-functions/params';
import Stripe from 'stripe';

// Secretos en Secret Manager, nunca en el código ni en el repo.
export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// URL pública del sitio, para success_url / cancel_url.
export const SITE_URL = defineString('SITE_URL', {
  default: 'http://localhost:3000',
});

let client: Stripe | null = null;

/**
 * No fijamos `apiVersion`: la librería ya viene clavada a la versión que
 * corresponde a sus tipos. Pasar una distinta a mano es la forma más rápida de
 * que el tipado diga una cosa y el JSON de Stripe traiga otra.
 */
export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(STRIPE_SECRET_KEY.value(), {
      maxNetworkRetries: 2,
      appInfo: { name: 'Universo Figuras' },
    });
  }
  return client;
}
