import { adminDb } from './admin';
import { gramsToPounds, mmToInches } from '../units';

/** Vista de producto para el panel: incluye borradores y archivados. */
export interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  priceCents: number;
  stock: number;
  reserved: number;
  available: number;
  tier: string;
  imageUrl: string | null;
  hasVideo: boolean;
  esPrint: boolean;
}

export async function listAllProducts(): Promise<AdminProductRow[]> {
  const snap = await adminDb.collection('products').orderBy('createdAt', 'desc').limit(200).get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      slug: data.slug ?? '',
      title: data.title ?? '(sin título)',
      status: data.status ?? 'draft',
      priceCents: data.priceCents ?? 0,
      stock: data.stock ?? 0,
      reserved: data.reserved ?? 0,
      available: data.available ?? 0,
      tier: data.shipping?.tier ?? 'standard',
      imageUrl: data.images?.[0]?.url ?? null,
      hasVideo: Boolean(data.videoId),
      // La categoría manda: es la misma que decide si sale en /prints o entre
      // las figuras de la portada.
      esPrint: (data.categories ?? []).includes('prints'),
    };
  });
}

export interface AdminPostRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  hasVideo: boolean;
  productCount: number;
  updatedAt: number | null;
}

export async function listAllPosts(): Promise<AdminPostRow[]> {
  const snap = await adminDb.collection('posts').orderBy('updatedAt', 'desc').limit(100).get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      slug: data.slug ?? '',
      title: data.title ?? '(sin título)',
      status: data.status ?? 'draft',
      hasVideo: Boolean(data.videoId),
      productCount: (data.productIds ?? []).length,
      updatedAt: data.updatedAt?.toMillis?.() ?? null,
    };
  });
}

export interface AdminPostDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: string;
  videoId: string;
  productIds: string[];
  tags: string;
  cover: { url: string; alt: string; storagePath: string; width: number; height: number } | null;
}

export async function getPostForEdit(id: string): Promise<AdminPostDetail | null> {
  const snap = await adminDb.collection('posts').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};

  return {
    id: snap.id,
    slug: data.slug ?? '',
    title: data.title ?? '',
    excerpt: data.excerpt ?? '',
    body: data.body ?? '',
    status: data.status ?? 'draft',
    videoId: data.videoId ?? '',
    productIds: data.productIds ?? [],
    tags: (data.tags ?? []).join(', '),
    cover: data.coverImage ?? null,
  };
}

export interface AdminOrderRow {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  email: string | null;
  country: string | null;
  createdAt: number | null;
  manualReview: boolean;
  itemCount: number;
}

export async function listOrders(max = 50): Promise<AdminOrderRow[]> {
  const snap = await adminDb.collection('orders').orderBy('createdAt', 'desc').limit(max).get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      number: data.number ?? doc.id.slice(0, 6),
      status: data.status ?? 'pending_payment',
      totalCents: data.totalCents ?? 0,
      email: data.customer?.email ?? null,
      country: data.shippingQuote?.country ?? null,
      createdAt: data.createdAt?.toMillis?.() ?? null,
      manualReview: data.flags?.manualReview ?? false,
      itemCount: (data.items ?? []).reduce((sum: number, item: { qty: number }) => sum + item.qty, 0),
    };
  });
}

export interface AdminOrderDetail {
  id: string;
  number: string;
  status: string;
  items: Array<{ title: string; qty: number; unitPriceCents: number; lineTotalCents: number }>;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  amountRefundedCents: number;
  email: string | null;
  name: string | null;
  phone: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  shippingLabel: string | null;
  shippingMethod: string | null;
  signatureRequired: boolean;
  manualReview: boolean;
  reasons: string[];
  consolidateHold: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: number | null;
  createdAt: number | null;
  paidAt: number | null;
}

export async function getOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  const snap = await adminDb.collection('orders').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};

  return {
    id: snap.id,
    number: data.number ?? snap.id.slice(0, 6),
    status: data.status ?? 'pending_payment',
    items: (data.items ?? []).map(
      (item: { title: string; qty: number; unitPriceCents: number; lineTotalCents: number }) => ({
        title: item.title,
        qty: item.qty,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents,
      })
    ),
    subtotalCents: data.subtotalCents ?? 0,
    shippingCents: data.shippingCents ?? 0,
    taxCents: data.taxCents ?? 0,
    totalCents: data.totalCents ?? 0,
    amountRefundedCents: data.amountRefundedCents ?? 0,
    email: data.customer?.email ?? null,
    name: data.customer?.name ?? null,
    phone: data.customer?.phone ?? null,
    address: data.shippingAddress ?? null,
    shippingLabel: data.shippingQuote?.rateLabel ?? null,
    shippingMethod: data.shippingQuote?.method ?? null,
    signatureRequired: data.signatureRequired ?? false,
    manualReview: data.flags?.manualReview ?? false,
    reasons: data.flags?.reasons ?? [],
    consolidateHold: data.consolidateHold ?? false,
    carrier: data.fulfillment?.carrier ?? null,
    trackingNumber: data.fulfillment?.trackingNumber ?? null,
    trackingUrl: data.fulfillment?.trackingUrl ?? null,
    shippedAt: data.fulfillment?.shippedAt?.toMillis?.() ?? null,
    createdAt: data.createdAt?.toMillis?.() ?? null,
    paidAt: data.paidAt?.toMillis?.() ?? null,
  };
}

export interface AdminProductDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  manufacturer: string;
  line: string;
  scale: string;
  condition: string;
  price: string; // en dólares, para el formulario
  status: string;
  featured: boolean;
  stock: number;
  reserved: number;
  available: number;
  tier: string;
  // Ya convertidos para el formulario: el dueño mide en libras y pulgadas.
  weightLb: number;
  dimsIn: { length: number; width: number; height: number };
  freeShippingEligible: boolean;
  localPickupEligible: boolean;
  internationalEligible: boolean;
  handlingDays: number;
  consolidateHold: boolean;
  videoId: string;
  videoTitle: string;
  videoStartSeconds: number | null;
  categories: string;
  tags: string;
  images: Array<{ url: string; alt: string; storagePath: string; width: number; height: number }>;
}

export async function getProductForEdit(id: string): Promise<AdminProductDetail | null> {
  const snap = await adminDb.collection('products').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};

  return {
    id: snap.id,
    slug: data.slug ?? '',
    title: data.title ?? '',
    subtitle: data.subtitle ?? '',
    description: data.description ?? '',
    manufacturer: data.manufacturer ?? '',
    line: data.line ?? '',
    scale: data.scale ?? '',
    condition: data.condition ?? 'new',
    // Centavos → dólares SOLO aquí, para pintarlo en el formulario. La vuelta
    // la hace el servidor al guardar (I2).
    price: ((data.priceCents ?? 0) / 100).toFixed(2),
    status: data.status ?? 'draft',
    featured: data.featured ?? false,
    stock: data.stock ?? 0,
    reserved: data.reserved ?? 0,
    available: data.available ?? 0,
    tier: data.shipping?.tier ?? 'standard',
    weightLb: gramsToPounds(data.shipping?.weightGrams ?? 0),
    dimsIn: {
      length: mmToInches(data.shipping?.dimsMm?.length ?? 0),
      width: mmToInches(data.shipping?.dimsMm?.width ?? 0),
      height: mmToInches(data.shipping?.dimsMm?.height ?? 0),
    },
    freeShippingEligible: data.shipping?.freeShippingEligible ?? true,
    localPickupEligible: data.shipping?.localPickupEligible ?? true,
    internationalEligible: data.shipping?.internationalEligible ?? true,
    handlingDays: data.fulfillment?.handlingDays ?? 2,
    consolidateHold: data.fulfillment?.consolidateHold ?? false,
    videoId: data.videoId ?? '',
    videoTitle: data.videoSnapshot?.title ?? '',
    videoStartSeconds: data.videoSnapshot?.startSeconds ?? null,
    categories: (data.categories ?? []).join(', '),
    tags: (data.tags ?? []).join(', '),
    images: data.images ?? [],
  };
}
