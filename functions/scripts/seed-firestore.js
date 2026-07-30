/**
 * Siembra la configuración mínima para que la tienda funcione:
 * config/shipping, config/store, config/fraud y dos productos de prueba.
 *
 * Es idempotente: la configuración se reescribe siempre (para poder corregir
 * tarifas), los productos de prueba solo se crean si no existen — nunca pisa
 * stock real.
 *
 *   node scripts/seed-firestore.js
 *   node scripts/seed-firestore.js --emulator
 *
 * Credenciales: Application Default Credentials
 *   gcloud auth application-default login
 */
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'universo-figuras';
const useEmulator = process.argv.includes('--emulator');

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

// --- config/shipping ---------------------------------------------------
// Tarifas PLACEHOLDER. Verificar en Pirate Ship antes de cobrar de verdad.
// A partir de aquí las edita el dueño desde el panel, no este archivo (I10).
const shipping = {
  version: 1,
  currency: 'usd',
  domestic: {
    country: 'US',
    tiers: {
      standard: {
        label: 'USPS Priority Mail (2-3 días hábiles)',
        carrier: 'USPS',
        service: 'Priority Mail Flat Rate Medium',
        baseCents: 1200,
        additionalItemCents: 400,
        deliveryDays: { min: 2, max: 3 },
      },
      large: {
        label: 'USPS Priority Mail (2-3 días hábiles)',
        carrier: 'USPS',
        service: 'Priority Mail Flat Rate Large',
        baseCents: 1800,
        additionalItemCents: 500,
        deliveryDays: { min: 2, max: 3 },
      },
      heavy: {
        label: 'UPS Ground (3-6 días hábiles)',
        carrier: 'UPS',
        service: 'Ground',
        baseCents: 3200,
        additionalItemCents: 900,
        deliveryDays: { min: 3, max: 6 },
      },
    },
    freeShipping: { enabled: true, thresholdCents: 15000, excludedTiers: [] },
  },
  international: {
    enabled: true,
    carrier: 'DHL Express',
    bands: {
      band_mx: {
        label: 'DHL Express a México (3-5 días hábiles)',
        countries: ['MX'],
        tiers: {
          standard: { baseCents: 4500, additionalItemCents: 1200 },
          large: { baseCents: 5800, additionalItemCents: 1500 },
        },
        deliveryDays: { min: 3, max: 5 },
      },
      band_latam_a: {
        label: 'DHL Express a Latinoamérica (4-7 días hábiles)',
        countries: ['CR', 'PA', 'GT', 'SV', 'HN', 'NI', 'DO', 'CO', 'EC', 'PE', 'CL'],
        tiers: {
          standard: { baseCents: 6500, additionalItemCents: 1800 },
          large: { baseCents: 8200, additionalItemCents: 2200 },
        },
        deliveryDays: { min: 4, max: 7 },
      },
      band_latam_b: {
        label: 'DHL Express a Sudamérica (5-9 días hábiles)',
        countries: ['BR', 'AR', 'UY', 'PY', 'BO'],
        tiers: {
          standard: { baseCents: 9500, additionalItemCents: 2500 },
          large: { baseCents: 11500, additionalItemCents: 3000 },
        },
        deliveryDays: { min: 5, max: 9 },
      },
    },
  },
  localPickup: {
    enabled: true,
    feeCents: 0,
    // Sin ubicación en la etiqueta: config/shipping es de lectura pública y
    // esta etiqueta se muestra dentro de Stripe. El punto de encuentro se
    // acuerda por email con quien ya compró.
    label: 'Recogido en persona',
    instructions: 'Coordinamos el punto de encuentro por email después de la compra.',
  },
  shippingTaxCode: 'txcd_92010001',
  reservationTtlMinutes: 30,
  updatedAt: FieldValue.serverTimestamp(),
  updatedBy: 'seed',
};

const store = {
  storeName: 'Universo Figuras',
  supportEmail: 'REEMPLAZAR@ejemplo.com',
  // PONER EN true ANTES DE LA PRIMERA VENTA REAL.
  // En false las sesiones se crean sin cálculo de impuesto. Está así para
  // poder desarrollar antes de cargar la dirección fiscal en Stripe: con
  // automatic_tax encendido y sin dirección, Stripe rechaza TODA sesión.
  // Una venta en Connecticut sin impuesto sobre las ventas la paga el dueño.
  automaticTaxEnabled: false,
  youtubeChannelUrl: 'REEMPLAZAR',
  social: { instagram: null, tiktok: null, x: null },
  policies: { returnsMarkdown: '', shippingMarkdown: '' },
  updatedAt: FieldValue.serverTimestamp(),
};

// La dirección de origen NO va en config/store: ese documento es de lectura
// pública (el frontend lee de ahí el nombre y las políticas). Vive en su
// propio documento, que las reglas solo dejan leer al admin.
const origin = {
  line1: 'REEMPLAZAR',
  line2: null,
  city: 'REEMPLAZAR',
  state: 'CT',
  postalCode: 'REEMPLAZAR',
  country: 'US',
  updatedAt: FieldValue.serverTimestamp(),
};

const fraud = {
  signatureRequiredAboveCents: 15000,
  manualReviewAboveCents: 30000,
  manualReviewIfBillingCountryDiffers: true,
  updatedAt: FieldValue.serverTimestamp(),
};

// --- productos de prueba ----------------------------------------------
function demoProduct(over) {
  return {
    slug: over.slug,
    title: over.title,
    subtitle: null,
    description: 'Producto de prueba creado por el seed. Bórralo antes de abrir la tienda.',
    sku: null,
    manufacturer: 'McFarlane Toys',
    line: 'DC Multiverse',
    scale: '7 pulgadas',
    condition: 'new',
    categories: ['prueba'],
    tags: ['prueba'],
    priceCents: over.priceCents,
    compareAtPriceCents: null,
    currency: 'usd',
    taxCode: 'txcd_99999999',
    stock: over.stock,
    reserved: 0,
    available: over.stock,
    inStock: over.stock > 0,
    shipping: {
      tier: over.tier,
      weightGrams: over.weightGrams,
      dimsMm: over.dimsMm,
      // Un artículo 'heavy' nunca sale del país.
      internationalEligible: over.tier !== 'heavy',
      freeShippingEligible: true,
      localPickupEligible: true,
    },
    fulfillment: {
      handlingDays: 2,
      consolidateHold: false,
      preorder: { isPreorder: false, expectedShipDate: null },
    },
    videoId: null,
    videoSnapshot: null,
    images: [],
    status: 'active',
    featured: false,
    seo: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    publishedAt: FieldValue.serverTimestamp(),
    createdBy: 'seed',
  };
}

const demos = [
  {
    id: 'demo-standard',
    data: demoProduct({
      slug: 'figura-prueba',
      title: 'Figura de prueba',
      priceCents: 4999,
      stock: 3,
      tier: 'standard',
      weightGrams: 900,
      dimsMm: { length: 280, width: 200, height: 90 },
    }),
  },
  // Tier 'large', no 'heavy': lo que vende son figuras, no estatuas de 7 kg.
  // El tier heavy sigue existiendo en config/shipping como válvula de escape
  // para el día que aparezca una pieza que no entre en una caja Flat Rate.
  {
    id: 'demo-large',
    data: demoProduct({
      slug: 'estatua-prueba',
      title: 'Figura grande de prueba',
      priceCents: 19999,
      stock: 1,
      tier: 'large',
      weightGrams: 2600,
      dimsMm: { length: 400, width: 300, height: 180 },
    }),
  },
];

async function main() {
  console.log(`Proyecto: ${PROJECT_ID}${useEmulator ? ' (emulador)' : ''}`);

  await db.collection('config').doc('shipping').set(shipping);
  console.log('OK  config/shipping');

  await db.collection('config').doc('store').set(store, { merge: true });
  console.log('OK  config/store');

  await db.collection('config').doc('origin').set(origin, { merge: true });
  console.log('OK  config/origin (privado)');

  await db.collection('config').doc('fraud').set(fraud, { merge: true });
  console.log('OK  config/fraud');

  for (const demo of demos) {
    const ref = db.collection('products').doc(demo.id);
    const snap = await ref.get();
    if (snap.exists) {
      // No pisamos stock existente: podría haber unidades reservadas.
      console.log(`--  products/${demo.id} ya existe, sin tocar`);
      continue;
    }
    await ref.set(demo.data);
    console.log(`OK  products/${demo.id}`);
  }

  console.log('\nListo. Recuerda reemplazar los REEMPLAZAR de config/store.');
}

main().catch((error) => {
  console.error('\nFalló el seed:', error.message);
  process.exit(1);
});
