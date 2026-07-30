'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/server/admin';
import { readAdminSession } from '@/lib/server/auth';
import { inchesToMm, poundsToGrams } from '@/lib/units';

export interface SaveProductInput {
  id: string;
  isNew: boolean;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  manufacturer: string;
  line: string;
  scale: string;
  condition: string;
  price: string; // en dólares, tal como lo escribió el dueño
  status: string;
  featured: boolean;
  stock: number; // solo se usa al crear
  tier: string;
  // El formulario habla en libras y pulgadas; la conversión a gramos y
  // milímetros ocurre aquí, al guardar.
  weightLb: number;
  dimsIn: { length: number; width: number; height: number };
  freeShippingEligible: boolean;
  localPickupEligible: boolean;
  internationalEligible: boolean;
  handlingDays: number;
  consolidateHold: boolean;
  videoUrl: string;
  videoTitle: string;
  videoStart: string;
  categories: string;
  tags: string;
  images: Array<{ url: string; alt: string; storagePath: string; width: number; height: number }>;
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** "49.99" → 4999. Entero, siempre (I2). */
function toCents(value: string): number | null {
  const clean = value.replace(/[^0-9.,]/g, '').replace(',', '.');
  const amount = Number.parseFloat(clean);
  if (!Number.isFinite(amount) || amount < 0) return null;
  // El *100 de un float da 4998.999...; el redondeo es obligatorio, no cosmético.
  return Math.round(amount * 100);
}

/** Acepta el link completo de YouTube o el ID pelado. */
function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;

  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Acepta "1:45" o "105". */
function toSeconds(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  const match = value.match(/^(\d+):([0-5]?\d)$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface SavePostInput {
  id: string;
  isNew: boolean;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: string;
  videoUrl: string;
  productIds: string[];
  tags: string;
  cover: { url: string; alt: string; storagePath: string; width: number; height: number } | null;
}

export async function savePost(input: SavePostInput): Promise<SaveResult> {
  const session = await readAdminSession();
  if (!session) return { ok: false, error: 'Tu sesión venció. Vuelve a entrar.' };

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'La entrada necesita un título.' };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'La entrada está vacía.' };

  const slug = slugify(input.slug || title);
  if (!slug) return { ok: false, error: 'No pudimos generar la dirección web de la entrada.' };

  const clash = await adminDb.collection('posts').where('slug', '==', slug).limit(2).get();
  if (clash.docs.some((doc) => doc.id !== input.id)) {
    return { ok: false, error: `Ya existe otra entrada con la dirección "${slug}".` };
  }

  const videoId = extractVideoId(input.videoUrl);
  if (input.videoUrl.trim() && !videoId) {
    return { ok: false, error: 'Ese link de YouTube no se entiende. Pega la dirección completa.' };
  }

  // Se calcula, no se pregunta: nadie sabe cuántos minutos dura su propio
  // texto, y 200 palabras por minuto es el promedio de lectura.
  const words = body.split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / 200));

  const excerpt = input.excerpt.trim() || `${body.slice(0, 155).trim()}…`;

  const common = {
    slug,
    title,
    excerpt,
    body,
    coverImage: input.cover,
    videoId,
    // La razón de ser del blog: la entrada enlaza a las figuras de las que
    // habla, y la ficha se vuelve el cierre de esa lectura.
    productIds: input.productIds,
    tags: splitList(input.tags),
    status: input.status,
    seo: { title: null, description: excerpt.slice(0, 155), ogImage: input.cover?.url ?? null },
    readingMinutes,
    authorUid: session.uid,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = adminDb.collection('posts').doc(input.id);

  if (input.isNew) {
    await ref.create({
      ...common,
      createdAt: FieldValue.serverTimestamp(),
      publishedAt: input.status === 'published' ? FieldValue.serverTimestamp() : null,
    });
  } else {
    const current = await ref.get();
    if (!current.exists) return { ok: false, error: 'Esa entrada ya no existe.' };
    await ref.update({
      ...common,
      publishedAt:
        input.status === 'published' && !current.get('publishedAt')
          ? FieldValue.serverTimestamp()
          : (current.get('publishedAt') ?? null),
    });
  }

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);

  return { ok: true, id: input.id };
}

/**
 * Enlaces de rastreo por transportista. El comprador quiere hacer clic, no
 * copiar un número y buscar en qué página pegarlo.
 */
const TRACKING_URL: Record<string, (n: string) => string> = {
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  DHL: (n) => `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
};

export type ShipResult = { ok: true } | { ok: false; error: string };

export async function markShipped(input: {
  orderId: string;
  carrier: string;
  trackingNumber: string;
}): Promise<ShipResult> {
  const session = await readAdminSession();
  if (!session) return { ok: false, error: 'Tu sesión venció. Vuelve a entrar.' };

  const trackingNumber = input.trackingNumber.trim().replace(/\s+/g, '');
  if (!trackingNumber) return { ok: false, error: 'Falta el número de rastreo.' };

  const ref = adminDb.collection('orders').doc(input.orderId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'Ese pedido no existe.' };

  const status = snap.get('status');
  // Despachar algo que no se pagó es regalar una figura.
  if (status !== 'paid' && status !== 'fulfilled') {
    return { ok: false, error: 'Este pedido todavía no está pagado.' };
  }

  const carrier = TRACKING_URL[input.carrier] ? input.carrier : 'USPS';

  await ref.update({
    status: 'fulfilled',
    'fulfillment.carrier': carrier,
    'fulfillment.trackingNumber': trackingNumber,
    'fulfillment.trackingUrl': TRACKING_URL[carrier](trackingNumber),
    'fulfillment.shippedAt': FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  revalidatePath('/admin/pedidos');
  revalidatePath(`/admin/pedidos/${input.orderId}`);
  return { ok: true };
}

export async function saveProduct(input: SaveProductInput): Promise<SaveResult> {
  const session = await readAdminSession();
  if (!session) return { ok: false, error: 'Tu sesión venció. Vuelve a entrar.' };

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'La figura necesita un título.' };

  const priceCents = toCents(input.price);
  if (priceCents === null) return { ok: false, error: 'El precio no es un número válido.' };
  if (priceCents === 0) return { ok: false, error: 'El precio no puede ser $0.' };

  // Peso y medidas son obligatorios aunque hoy la tarifa sea plana (I12):
  // medir 200 cajas hacia atrás el día que integremos tarifas reales es un
  // infierno.
  if (!Number.isFinite(input.weightLb) || input.weightLb <= 0) {
    return { ok: false, error: 'Falta el peso en libras.' };
  }
  const { length, width, height } = input.dimsIn;
  if (!length || !width || !height) {
    return { ok: false, error: 'Faltan las medidas de la caja (largo, ancho y alto).' };
  }

  const slug = slugify(input.slug || title);
  if (!slug) return { ok: false, error: 'No pudimos generar la dirección web de la figura.' };

  // Firestore no tiene índices únicos: la unicidad del slug se valida aquí.
  const clash = await adminDb.collection('products').where('slug', '==', slug).limit(2).get();
  if (clash.docs.some((doc) => doc.id !== input.id)) {
    return { ok: false, error: `Ya existe otra figura con la dirección "${slug}".` };
  }

  const videoId = extractVideoId(input.videoUrl);
  if (input.videoUrl.trim() && !videoId) {
    return { ok: false, error: 'Ese link de YouTube no se entiende. Pega la dirección completa.' };
  }

  const tier = ['standard', 'large', 'heavy'].includes(input.tier) ? input.tier : 'standard';

  const common = {
    slug,
    title,
    subtitle: input.subtitle.trim() || null,
    description: input.description.trim(),
    manufacturer: input.manufacturer.trim() || null,
    line: input.line.trim() || null,
    scale: input.scale.trim() || null,
    condition: input.condition,
    priceCents,
    currency: 'usd',
    taxCode: 'txcd_99999999',
    categories: splitList(input.categories),
    tags: splitList(input.tags),
    shipping: {
      tier,
      weightGrams: poundsToGrams(input.weightLb),
      dimsMm: {
        length: inchesToMm(length),
        width: inchesToMm(width),
        height: inchesToMm(height),
      },
      // Un artículo pesado no sale del país, marque lo que marque la casilla.
      internationalEligible: tier === 'heavy' ? false : input.internationalEligible,
      freeShippingEligible: input.freeShippingEligible,
      localPickupEligible: input.localPickupEligible,
    },
    fulfillment: {
      handlingDays: Math.max(0, Math.round(input.handlingDays)),
      consolidateHold: input.consolidateHold,
      preorder: { isPreorder: false, expectedShipDate: null },
    },
    videoId,
    videoSnapshot: videoId
      ? {
          title: input.videoTitle.trim() || title,
          thumbUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          startSeconds: toSeconds(input.videoStart),
        }
      : null,
    images: input.images,
    status: input.status,
    featured: input.featured,
    seo: null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = adminDb.collection('products').doc(input.id);

  if (input.isNew) {
    const stock = Math.max(0, Math.round(input.stock));
    await ref.create({
      ...common,
      // Los cuatro campos de inventario nacen coherentes y de aquí en adelante
      // solo los mueve el servidor: reponer pasa por adjustStockLevel.
      stock,
      reserved: 0,
      available: stock,
      inStock: stock > 0,
      createdAt: FieldValue.serverTimestamp(),
      publishedAt: input.status === 'active' ? FieldValue.serverTimestamp() : null,
      createdBy: session.uid,
    });
  } else {
    const current = await ref.get();
    if (!current.exists) return { ok: false, error: 'Esa figura ya no existe.' };

    // Ni stock, ni reserved, ni available, ni inStock. Si el formulario los
    // tocara, una compra en curso quedaría descuadrada.
    await ref.update({
      ...common,
      publishedAt:
        input.status === 'active' && !current.get('publishedAt')
          ? FieldValue.serverTimestamp()
          : (current.get('publishedAt') ?? null),
    });
  }

  revalidatePath('/admin/productos');
  revalidatePath('/');
  revalidatePath(`/producto/${slug}`);

  return { ok: true, id: input.id };
}
