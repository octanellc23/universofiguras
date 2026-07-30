// Verificación rápida del cotizador (I8, I9, I11) contra lib/ compilado.
const path = require('path');
const { buildShippingOptions } = require(path.join(__dirname, '..', 'lib', 'shipping.js'));

const config = {
  version: 1,
  currency: 'usd',
  domestic: {
    country: 'US',
    tiers: {
      standard: { label: 'USPS Priority', carrier: 'USPS', service: 'FR Medium', baseCents: 1200, additionalItemCents: 400, deliveryDays: { min: 2, max: 3 } },
      large: { label: 'USPS Priority L', carrier: 'USPS', service: 'FR Large', baseCents: 1800, additionalItemCents: 500, deliveryDays: { min: 2, max: 3 } },
      heavy: { label: 'UPS Ground', carrier: 'UPS', service: 'Ground', baseCents: 3200, additionalItemCents: 900, deliveryDays: { min: 3, max: 6 } },
    },
    freeShipping: { enabled: true, thresholdCents: 15000, excludedTiers: [] },
  },
  international: {
    enabled: true,
    carrier: 'DHL Express',
    bands: {
      band_mx: { label: 'DHL MX', countries: ['MX'], tiers: { standard: { baseCents: 4500, additionalItemCents: 1200 }, large: { baseCents: 5800, additionalItemCents: 1500 } }, deliveryDays: { min: 3, max: 5 } },
      band_latam_b: { label: 'DHL SA', countries: ['BR', 'AR'], tiers: { standard: { baseCents: 9500, additionalItemCents: 2500 } }, deliveryDays: { min: 5, max: 9 } },
    },
  },
  localPickup: { enabled: true, feeCents: 0, label: 'Recogido en persona', instructions: '' },
  shippingTaxCode: 'txcd_92010001',
  reservationTtlMinutes: 30,
};

const item = (over = {}) => ({
  productId: 'p1', slug: 's', title: 'Figura', imageUrl: null,
  unitPriceCents: 4999, qty: 1, lineTotalCents: 4999, available: 3,
  taxCode: 'txcd_99999999', tier: 'standard', weightGrams: 900,
  internationalEligible: true, freeShippingEligible: true, localPickupEligible: true,
  consolidateHold: false, ...over,
});

let fails = 0;
function eq(label, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${got}${ok ? '' : ` (esperado ${want})`}`);
}
function throws(label, fn, fragment) {
  try {
    fn();
    fails++;
    console.log(`FAIL ${label}: no lanzó`);
  } catch (e) {
    const ok = String(e.message).includes(fragment);
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: "${e.message}"`);
  }
}

// I8: tier más alto + incremento, NO la suma de envíos individuales
eq('3 standard = 1200 + 400*2',
  buildShippingOptions([item({ qty: 3, lineTotalCents: 14997 })], 'US', config)[0].amountCents, 2000);

eq('standard + heavy => tarifa heavy',
  buildShippingOptions([item({ qty: 1, lineTotalCents: 4999 }), item({ productId: 'p2', tier: 'heavy', internationalEligible: false, qty: 1, lineTotalCents: 4999 })], 'US', config)[0].amountCents, 4100);

eq('NO es la suma de envíos individuales (1200+3200=4400)',
  buildShippingOptions([item(), item({ productId: 'p2', tier: 'heavy', internationalEligible: false })], 'US', config)[0].amountCents !== 4400, true);

// Envío gratis doméstico
eq('subtotal 15000 => envío gratis',
  buildShippingOptions([item({ qty: 3, lineTotalCents: 15000 })], 'US', config)[0].amountCents, 0);
eq('subtotal 14999 => cobra envío',
  buildShippingOptions([item({ qty: 3, lineTotalCents: 14999 })], 'US', config)[0].amountCents, 2000);
eq('un artículo no elegible => cobra envío igual',
  buildShippingOptions([item({ qty: 3, lineTotalCents: 20000, freeShippingEligible: false })], 'US', config)[0].amountCents, 2000);

// I11: internacional nunca gratis
eq('MX 1 unidad = 4500',
  buildShippingOptions([item()], 'MX', config)[0].amountCents, 4500);
eq('MX 2 unidades = 4500 + 1200',
  buildShippingOptions([item({ qty: 2, lineTotalCents: 9998 })], 'MX', config)[0].amountCents, 5700);
eq('MX con subtotal alto NO es gratis (I11)',
  buildShippingOptions([item({ qty: 4, lineTotalCents: 40000 })], 'MX', config)[0].amountCents, 8100);

// heavy no sale del país
throws('heavy a MX rechaza en español',
  () => buildShippingOptions([item({ tier: 'heavy', internationalEligible: false })], 'MX', config),
  'solo lo enviamos dentro de Estados Unidos');
throws('país sin banda',
  () => buildShippingOptions([item()], 'ES', config), 'Todavía no enviamos');
throws('carrito vacío', () => buildShippingOptions([], 'US', config), 'carrito está vacío');

// pickup
eq('US ofrece recogido', buildShippingOptions([item()], 'US', config).length, 2);
eq('recogido cuesta 0', buildShippingOptions([item()], 'US', config)[1].amountCents, 0);
eq('MX no ofrece recogido', buildShippingOptions([item()], 'MX', config).length, 1);
eq('artículo no elegible a pickup => sin opción',
  buildShippingOptions([item({ localPickupEligible: false })], 'US', config).length, 1);

// banda sin tarifa para el tier
throws('BR con tier large sin tarifa en la banda',
  () => buildShippingOptions([item({ tier: 'large' })], 'BR', config), 'No pudimos calcular el envío');

console.log(fails === 0 ? '\nTodo verde.' : `\n${fails} fallas.`);
process.exit(fails === 0 ? 0 : 1);
