import { adminDb } from './admin';
import { centsToDollars } from '../money';

/** Tarifas ya convertidas a dólares, listas para el formulario. */
export interface RateForm {
  label: string;
  base: string;
  additional: string;
  daysMin: number;
  daysMax: number;
}

export interface BandForm {
  id: string;
  label: string;
  countries: string;
  standardBase: string;
  standardAdditional: string;
  largeBase: string;
  largeAdditional: string;
  daysMin: number;
  daysMax: number;
}

export interface ShippingForm {
  version: number;
  print: RateForm;
  standard: RateForm;
  large: RateForm;
  heavy: RateForm;
  freeEnabled: boolean;
  freeThreshold: string;
  internationalEnabled: boolean;
  bands: BandForm[];
  pickupEnabled: boolean;
  pickupFee: string;
  pickupLabel: string;
  pickupInstructions: string;
}

function rate(raw: Record<string, unknown> | undefined, fallbackLabel: string): RateForm {
  const days = (raw?.deliveryDays ?? {}) as { min?: number; max?: number };
  return {
    label: (raw?.label as string) ?? fallbackLabel,
    base: centsToDollars((raw?.baseCents as number) ?? 0),
    additional: centsToDollars((raw?.additionalItemCents as number) ?? 0),
    daysMin: days.min ?? 2,
    daysMax: days.max ?? 5,
  };
}

export async function getShippingForm(): Promise<ShippingForm> {
  const snap = await adminDb.collection('config').doc('shipping').get();
  const data = (snap.data() ?? {}) as Record<string, never> & {
    version?: number;
    domestic?: {
      tiers?: Record<string, Record<string, unknown>>;
      freeShipping?: { enabled?: boolean; thresholdCents?: number };
    };
    international?: {
      enabled?: boolean;
      bands?: Record<string, Record<string, unknown>>;
    };
    localPickup?: {
      enabled?: boolean;
      feeCents?: number;
      label?: string;
      instructions?: string;
    };
  };

  const tiers = data.domestic?.tiers ?? {};
  const bandsRaw = data.international?.bands ?? {};

  const bands: BandForm[] = Object.entries(bandsRaw).map(([id, band]) => {
    const b = band as {
      label?: string;
      countries?: string[];
      deliveryDays?: { min?: number; max?: number };
      tiers?: Record<string, { baseCents?: number; additionalItemCents?: number }>;
    };
    return {
      id,
      label: b.label ?? id,
      countries: (b.countries ?? []).join(', '),
      standardBase: centsToDollars(b.tiers?.standard?.baseCents ?? 0),
      standardAdditional: centsToDollars(b.tiers?.standard?.additionalItemCents ?? 0),
      largeBase: centsToDollars(b.tiers?.large?.baseCents ?? 0),
      largeAdditional: centsToDollars(b.tiers?.large?.additionalItemCents ?? 0),
      daysMin: b.deliveryDays?.min ?? 4,
      daysMax: b.deliveryDays?.max ?? 9,
    };
  });

  return {
    version: data.version ?? 1,
    print: rate(tiers.print, 'USPS Ground Advantage'),
    standard: rate(tiers.standard, 'USPS Priority Mail'),
    large: rate(tiers.large, 'USPS Priority Mail (caja grande)'),
    heavy: rate(tiers.heavy, 'UPS Ground'),
    freeEnabled: data.domestic?.freeShipping?.enabled ?? false,
    freeThreshold: centsToDollars(data.domestic?.freeShipping?.thresholdCents ?? 0),
    internationalEnabled: data.international?.enabled ?? false,
    bands,
    pickupEnabled: data.localPickup?.enabled ?? false,
    pickupFee: centsToDollars(data.localPickup?.feeCents ?? 0),
    pickupLabel: data.localPickup?.label ?? 'Recogido en persona',
    pickupInstructions: data.localPickup?.instructions ?? '',
  };
}
