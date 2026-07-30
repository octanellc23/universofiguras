import { adminDb } from './admin';
import type { CountryOption, ProductView } from '../types';

/**
 * Lectura del catálogo del lado del servidor. El precio que se pinta en la
 * página sale de aquí; el navegador nunca lo propone (I1).
 */

interface RawProduct {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  manufacturer: string | null;
  line: string | null;
  scale: string | null;
  condition: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  available: number;
  stock: number;
  reserved: number;
  inStock: boolean;
  shipping: {
    tier: ProductView['tier'];
    weightGrams: number;
    dimsMm: { length: number; width: number; height: number };
    internationalEligible: boolean;
    localPickupEligible: boolean;
  };
  fulfillment: { handlingDays: number };
  videoId: string | null;
  videoSnapshot: { title: string; startSeconds: number | null } | null;
  images: Array<{ url: string; alt: string }>;
  status: string;
}

function toView(id: string, raw: RawProduct): ProductView {
  return {
    id,
    slug: raw.slug,
    title: raw.title,
    subtitle: raw.subtitle ?? null,
    description: raw.description ?? '',
    manufacturer: raw.manufacturer ?? null,
    line: raw.line ?? null,
    scale: raw.scale ?? null,
    condition: raw.condition ?? 'new',
    priceCents: raw.priceCents,
    compareAtPriceCents: raw.compareAtPriceCents ?? null,
    available: raw.available,
    stock: raw.stock ?? 0,
    reserved: raw.reserved ?? 0,
    inStock: raw.inStock,
    tier: raw.shipping.tier,
    weightGrams: raw.shipping.weightGrams,
    dimsMm: raw.shipping.dimsMm,
    internationalEligible: raw.shipping.internationalEligible,
    localPickupEligible: raw.shipping.localPickupEligible,
    handlingDays: raw.fulfillment?.handlingDays ?? 2,
    videoId: raw.videoId ?? null,
    videoTitle: raw.videoSnapshot?.title ?? null,
    videoStartSeconds: raw.videoSnapshot?.startSeconds ?? null,
    images: raw.images ?? [],
  };
}

export async function listActiveProducts(max = 24): Promise<ProductView[]> {
  const snap = await adminDb
    .collection('products')
    .where('status', '==', 'active')
    .orderBy('publishedAt', 'desc')
    .limit(max)
    .get();

  return snap.docs.map((doc) => toView(doc.id, doc.data() as RawProduct));
}

/**
 * Las figuras de las que habla una reseña. Se filtran las que no estén
 * publicadas: si el dueño archivó una, la entrada del blog sigue viva pero deja
 * de ofrecer algo que no se puede comprar.
 */
export async function getProductsByIds(ids: string[]): Promise<ProductView[]> {
  if (ids.length === 0) return [];

  const refs = ids.slice(0, 10).map((id) => adminDb.collection('products').doc(id));
  const snaps = await adminDb.getAll(...refs);

  return snaps
    .filter((snap) => snap.exists && (snap.data() as RawProduct).status === 'active')
    .map((snap) => toView(snap.id, snap.data() as RawProduct));
}

export async function getProductBySlug(slug: string): Promise<ProductView | null> {
  const snap = await adminDb
    .collection('products')
    .where('status', '==', 'active')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return toView(doc.id, doc.data() as RawProduct);
}

// Nombres en español de los países a los que enviamos. Las bandas viven en
// Firestore; esto es solo la traducción para el selector.
const COUNTRY_NAMES: Record<string, string> = {
  US: 'Estados Unidos',
  MX: 'México',
  CR: 'Costa Rica',
  PA: 'Panamá',
  GT: 'Guatemala',
  SV: 'El Salvador',
  HN: 'Honduras',
  NI: 'Nicaragua',
  DO: 'República Dominicana',
  CO: 'Colombia',
  EC: 'Ecuador',
  PE: 'Perú',
  CL: 'Chile',
  BR: 'Brasil',
  AR: 'Argentina',
  UY: 'Uruguay',
  PY: 'Paraguay',
  BO: 'Bolivia',
};

interface RawShippingConfig {
  domestic: { country: string; freeShipping: { enabled: boolean; thresholdCents: number } };
  international: { enabled: boolean; bands: Record<string, { countries: string[] }> };
}

export async function getShippingCountries(): Promise<CountryOption[]> {
  const snap = await adminDb.collection('config').doc('shipping').get();
  const config = snap.data() as RawShippingConfig | undefined;
  if (!config) return [{ code: 'US', name: COUNTRY_NAMES.US }];

  const codes = [config.domestic.country];
  if (config.international.enabled) {
    for (const band of Object.values(config.international.bands)) {
      codes.push(...band.countries);
    }
  }

  return codes.map((code) => ({ code, name: COUNTRY_NAMES[code] ?? code }));
}

export async function getFreeShippingThreshold(): Promise<number | null> {
  const snap = await adminDb.collection('config').doc('shipping').get();
  const config = snap.data() as RawShippingConfig | undefined;
  if (!config?.domestic.freeShipping.enabled) return null;
  return config.domestic.freeShipping.thresholdCents;
}

export interface OrderView {
  id: string;
  number: string;
  status: string;
  items: Array<{ title: string; qty: number; lineTotalCents: number }>;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  customerEmail: string | null;
}

export async function getOrder(orderId: string): Promise<OrderView | null> {
  const snap = await adminDb.collection('orders').doc(orderId).get();
  if (!snap.exists) return null;

  const data = snap.data() as {
    number: string;
    status: string;
    items: Array<{ title: string; qty: number; lineTotalCents: number }>;
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
    customer: { email: string | null } | null;
  };

  return {
    id: snap.id,
    number: data.number,
    status: data.status,
    items: data.items.map((item) => ({
      title: item.title,
      qty: item.qty,
      lineTotalCents: item.lineTotalCents,
    })),
    subtotalCents: data.subtotalCents,
    shippingCents: data.shippingCents,
    taxCents: data.taxCents,
    totalCents: data.totalCents,
    customerEmail: data.customer?.email ?? null,
  };
}
