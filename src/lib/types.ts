export type ShippingTier = 'standard' | 'large' | 'heavy';

/** Producto ya aplanado y serializable para pasar de servidor a cliente. */
export interface ProductView {
  id: string;
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
  inStock: boolean;
  tier: ShippingTier;
  weightGrams: number;
  dimsMm: { length: number; width: number; height: number };
  internationalEligible: boolean;
  localPickupEligible: boolean;
  handlingDays: number;
  videoId: string | null;
  videoTitle: string | null;
  videoStartSeconds: number | null;
  images: Array<{ url: string; alt: string }>;
}

/** Lo que devuelve la callable quoteCart. */
export interface ShippingOptionView {
  id: string;
  method: 'domestic' | 'international' | 'pickup';
  label: string;
  amountCents: number;
  bandId: string | null;
  freeShippingApplied: boolean;
  deliveryDays: { min: number; max: number } | null;
}

export interface QuoteItemView {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  unitPriceCents: number;
  qty: number;
  lineTotalCents: number;
  available: number;
}

export interface CartQuoteView {
  items: QuoteItemView[];
  subtotalCents: number;
  units: number;
  country: string;
  options: ShippingOptionView[];
}

export interface CountryOption {
  code: string;
  name: string;
}
