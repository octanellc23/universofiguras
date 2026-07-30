import type { Timestamp } from 'firebase-admin/firestore';

// Ver FIRESTORE-SCHEMA.md. Estos tipos son el contrato; si cambian, ese archivo
// cambia en el mismo commit.

export type ShippingTier = 'standard' | 'large' | 'heavy';
export type ShippingMethod = 'domestic' | 'international' | 'pickup';

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface ProductDoc {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: 'usd';
  taxCode: string;
  stock: number;
  reserved: number;
  available: number;
  inStock: boolean;
  shipping: {
    tier: ShippingTier;
    weightGrams: number;
    dimsMm: { length: number; width: number; height: number };
    internationalEligible: boolean;
    freeShippingEligible: boolean;
    localPickupEligible: boolean;
  };
  fulfillment: {
    handlingDays: number;
    consolidateHold: boolean;
    preorder: { isPreorder: boolean; expectedShipDate: Timestamp | null };
  };
  images: Array<{ url: string; alt: string }>;
  status: ProductStatus;
}

// --- config/shipping ---------------------------------------------------

export interface DeliveryDays {
  min: number;
  max: number;
}

export interface DomesticRate {
  label: string;
  carrier: string;
  service: string;
  baseCents: number;
  additionalItemCents: number;
  deliveryDays: DeliveryDays;
}

export interface BandRate {
  baseCents: number;
  additionalItemCents: number;
}

export interface ShippingBand {
  label: string;
  countries: string[];
  // 'heavy' no aparece: los artículos pesados no salen de Estados Unidos.
  tiers: Partial<Record<Exclude<ShippingTier, 'heavy'>, BandRate>>;
  deliveryDays: DeliveryDays;
}

export interface ShippingConfig {
  version: number;
  currency: 'usd';
  domestic: {
    country: string;
    tiers: Record<ShippingTier, DomesticRate>;
    freeShipping: {
      enabled: boolean;
      thresholdCents: number;
      excludedTiers: ShippingTier[];
    };
  };
  international: {
    enabled: boolean;
    carrier: string;
    bands: Record<string, ShippingBand>;
  };
  localPickup: {
    enabled: boolean;
    feeCents: number;
    label: string;
    instructions: string;
  };
  shippingTaxCode: string;
  reservationTtlMinutes: number;
}

export interface StoreConfig {
  storeName: string;
  supportEmail: string;
  /**
   * Interruptor de Stripe Tax. En false, las sesiones se crean SIN cálculo de
   * impuesto: sirve para desarrollar antes de tener cargada la dirección
   * fiscal, porque con automatic_tax encendido y sin dirección Stripe rechaza
   * toda sesión.
   *
   * DEBE estar en true antes de la primera venta real: una venta en
   * Connecticut sin impuesto sobre las ventas es un problema del dueño con el
   * estado, no un detalle técnico.
   */
  automaticTaxEnabled: boolean;
}

export interface FraudConfig {
  signatureRequiredAboveCents: number;
  manualReviewAboveCents: number;
  manualReviewIfBillingCountryDiffers: boolean;
}

// --- cotización --------------------------------------------------------

/** Lo único que el navegador tiene permitido mandar (I1). */
export interface CartLineInput {
  productId: string;
  qty: number;
}

/** Línea ya resuelta contra Firestore. Todo lo de aquí lo puso el servidor. */
export interface QuoteItem {
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  unitPriceCents: number;
  qty: number;
  lineTotalCents: number;
  available: number;
  taxCode: string;
  tier: ShippingTier;
  weightGrams: number;
  internationalEligible: boolean;
  freeShippingEligible: boolean;
  localPickupEligible: boolean;
  consolidateHold: boolean;
}

export interface ShippingOption {
  id: string;
  method: ShippingMethod;
  label: string;
  amountCents: number;
  country: string;
  bandId: string | null;
  tier: ShippingTier;
  units: number;
  baseCents: number;
  additionalItemCents: number;
  freeShippingApplied: boolean;
  deliveryDays: DeliveryDays | null;
  ratesVersion: number;
}

export interface CartQuote {
  items: QuoteItem[];
  subtotalCents: number;
  units: number;
  country: string;
  options: ShippingOption[];
  ratesVersion: number;
}

// --- reservas ----------------------------------------------------------

export type ReservationStatus = 'active' | 'consumed' | 'released';
export type ReleaseReason = 'expired' | 'stripe_expired' | 'canceled';

export interface ReservationItem {
  productId: string;
  qty: number;
}

export interface ReservationDoc {
  orderId: string;
  sessionId: string | null;
  status: ReservationStatus;
  items: ReservationItem[];
  expiresAt: Timestamp;
  releaseReason: ReleaseReason | null;
  createdAt: Timestamp;
  consumedAt: Timestamp | null;
  releasedAt: Timestamp | null;
}

export type LedgerType = 'reserve' | 'release' | 'sale' | 'restock' | 'adjust';

// --- pedidos -----------------------------------------------------------

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'fulfilled'
  | 'expired'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded';
