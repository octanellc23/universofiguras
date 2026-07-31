import { HttpsError } from 'firebase-functions/v2/https';
import type {
  QuoteItem,
  ShippingBand,
  ShippingConfig,
  ShippingOption,
  ShippingTier,
} from './types';

/**
 * ESTA es la única implementación del cálculo de envío (I9). El cotizador del
 * carrito y createCheckout llaman aquí. Si algún día aparece un segundo
 * `baseCents + additionalItemCents * ...` en otro archivo, es un bug: el
 * comprador vería un número en el carrito y otro en Stripe, y eso termina en
 * disputa.
 */

const TIER_RANK: Record<ShippingTier, number> = {
  print: 0,
  standard: 1,
  large: 2,
  heavy: 3,
};

export function totalUnits(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

export function subtotalCents(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + item.lineTotalCents, 0);
}

/** El tier del carrito es el más alto presente, no la suma de los tiers (I8). */
export function highestTier(items: QuoteItem[]): ShippingTier {
  return items.reduce<ShippingTier>(
    (acc, item) => (TIER_RANK[item.tier] > TIER_RANK[acc] ? item.tier : acc),
    // Se arranca desde el más barato: si el carrito solo trae láminas, el
    // envío es el de láminas, no el de una caja de figura.
    'print'
  );
}

/**
 * Regla del carrito (I8): tier más alto + incremento por artículo adicional.
 * NO la suma de envíos individuales — nadie paga $54 de shipping por tres
 * figuras.
 */
function combine(baseCents: number, additionalItemCents: number, units: number): number {
  return baseCents + additionalItemCents * Math.max(0, units - 1);
}

function findBand(
  country: string,
  config: ShippingConfig
): { bandId: string; band: ShippingBand } | null {
  for (const [bandId, band] of Object.entries(config.international.bands)) {
    if (band.countries.includes(country)) {
      return { bandId, band };
    }
  }
  return null;
}

/**
 * Devuelve las opciones de envío para un carrito y un país. La primera es
 * siempre la de entrega a domicilio; el recogido en persona, si aplica, va
 * después.
 *
 * El país llega desde nuestro sitio ANTES de crear la sesión de Stripe (I7):
 * Stripe fija shipping_options al crear la sesión y no nos vuelve a preguntar
 * cuando el comprador escribe su dirección.
 */
export function buildShippingOptions(
  items: QuoteItem[],
  country: string,
  config: ShippingConfig
): ShippingOption[] {
  if (items.length === 0) {
    throw new HttpsError('invalid-argument', 'Tu carrito está vacío.');
  }

  const units = totalUnits(items);
  const tier = highestTier(items);
  const options: ShippingOption[] = [];

  if (country === config.domestic.country) {
    options.push(domesticOption(items, tier, units, country, config));
  } else {
    options.push(internationalOption(items, tier, units, country, config));
  }

  const pickup = pickupOption(items, tier, units, country, config);
  if (pickup) {
    options.push(pickup);
  }

  return options;
}

function domesticOption(
  items: QuoteItem[],
  tier: ShippingTier,
  units: number,
  country: string,
  config: ShippingConfig
): ShippingOption {
  const rate = config.domestic.tiers[tier];
  if (!rate) {
    throw new HttpsError(
      'failed-precondition',
      'No pudimos calcular el envío de este pedido. Escríbenos y lo resolvemos.'
    );
  }

  const amountBeforeDiscount = combine(rate.baseCents, rate.additionalItemCents, units);

  const free = config.domestic.freeShipping;
  const freeShippingApplied =
    free.enabled &&
    subtotalCents(items) >= free.thresholdCents &&
    !free.excludedTiers.includes(tier) &&
    // Basta con que un artículo no sea elegible para que el pedido completo
    // pague envío: no hay forma de mandar "medio paquete" gratis.
    items.every((item) => item.freeShippingEligible);

  return {
    id: `domestic_${tier}`,
    method: 'domestic',
    label: freeShippingApplied ? `${rate.label} — envío gratis` : rate.label,
    amountCents: freeShippingApplied ? 0 : amountBeforeDiscount,
    country,
    bandId: null,
    tier,
    units,
    baseCents: rate.baseCents,
    additionalItemCents: rate.additionalItemCents,
    freeShippingApplied,
    deliveryDays: rate.deliveryDays,
    ratesVersion: config.version,
  };
}

function internationalOption(
  items: QuoteItem[],
  tier: ShippingTier,
  units: number,
  country: string,
  config: ShippingConfig
): ShippingOption {
  if (!config.international.enabled) {
    throw new HttpsError(
      'failed-precondition',
      'Por ahora solo enviamos dentro de Estados Unidos.'
    );
  }

  // Los artículos pesados no salen del país: el flete los vuelve impagables y
  // el tier 'heavy' ni siquiera existe en las bandas internacionales.
  const heavy = items.find((item) => item.tier === 'heavy' || !item.internationalEligible);
  if (heavy) {
    throw new HttpsError(
      'failed-precondition',
      `"${heavy.title}" solo lo enviamos dentro de Estados Unidos. Quítalo del carrito para continuar con el envío internacional.`
    );
  }

  const found = findBand(country, config);
  if (!found) {
    throw new HttpsError(
      'failed-precondition',
      'Todavía no enviamos a ese país. Escríbenos y vemos si podemos hacer una excepción.'
    );
  }

  // Ya descartamos 'heavy' arriba, así que el tier solo puede ser standard o large.
  const bandTier = tier as Exclude<ShippingTier, 'heavy'>;
  const rate = found.band.tiers[bandTier];
  if (!rate) {
    throw new HttpsError(
      'failed-precondition',
      'No pudimos calcular el envío a ese país para este pedido. Escríbenos y lo resolvemos.'
    );
  }

  return {
    id: `intl_${found.bandId}_${bandTier}`,
    method: 'international',
    label: found.band.label,
    amountCents: combine(rate.baseCents, rate.additionalItemCents, units),
    country,
    bandId: found.bandId,
    tier: bandTier,
    units,
    baseCents: rate.baseCents,
    additionalItemCents: rate.additionalItemCents,
    // El envío gratis NUNCA aplica a internacional (I11): $95 de DHL se come el
    // margen completo. Ni se evalúa el umbral.
    freeShippingApplied: false,
    deliveryDays: found.band.deliveryDays,
    ratesVersion: config.version,
  };
}

function pickupOption(
  items: QuoteItem[],
  tier: ShippingTier,
  units: number,
  country: string,
  config: ShippingConfig
): ShippingOption | null {
  const pickup = config.localPickup;

  // Recoger en persona solo tiene sentido para quien está del lado de acá.
  if (!pickup.enabled || country !== config.domestic.country) {
    return null;
  }
  if (!items.every((item) => item.localPickupEligible)) {
    return null;
  }

  return {
    id: 'local_pickup',
    method: 'pickup',
    label: pickup.label,
    amountCents: pickup.feeCents,
    country,
    bandId: null,
    tier,
    units,
    baseCents: pickup.feeCents,
    additionalItemCents: 0,
    freeShippingApplied: false,
    deliveryDays: null,
    ratesVersion: config.version,
  };
}
