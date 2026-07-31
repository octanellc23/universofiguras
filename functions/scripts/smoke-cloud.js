/**
 * Prueba de humo contra las funciones YA DESPLEGADAS.
 *
 *   node scripts/smoke-cloud.js              solo cotiza (no toca inventario)
 *   node scripts/smoke-cloud.js --checkout   además crea una sesión real de
 *                                            Stripe en modo prueba y RESERVA
 *                                            stock por 30 minutos
 *
 * No trae números fijos a propósito: busca un producto publicado y calcula lo
 * que DEBERÍA cobrar leyendo config/shipping. Así sigue sirviendo cuando
 * cambien las tarifas o el catálogo, que es lo que pasó la primera vez.
 */
const admin = require('firebase-admin');

const REGION = 'us-east1';
const PROJECT = process.env.GCLOUD_PROJECT || 'universo-figuras';
const base = `https://${REGION}-${PROJECT}.cloudfunctions.net`;

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

async function callable(name, data) {
  const res = await fetch(`${base}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  return body.result;
}

let fails = 0;
function eq(label, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${got}${ok ? '' : ` (esperado ${want})`}`);
}
async function rejects(label, promise, fragment) {
  try {
    await promise;
    fails++;
    console.log(`FAIL ${label}: no falló`);
  } catch (error) {
    const ok = error.message.includes(fragment);
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: "${error.message}"`);
  }
}

async function main() {
  console.log(`Contra ${base}\n`);

  const config = (await db.collection('config').doc('shipping').get()).data();
  const snap = await db
    .collection('products')
    .where('status', '==', 'active')
    .where('inStock', '==', true)
    .limit(1)
    .get();

  if (snap.empty) {
    console.log('No hay ningún producto publicado y con stock. Nada que probar.');
    return;
  }

  const doc = snap.docs[0];
  const producto = { id: doc.id, ...doc.data() };
  const tier = producto.shipping.tier;
  const tarifa = config.domestic.tiers[tier];
  const libre = config.domestic.freeShipping;

  console.log(`producto: "${producto.title}" (${tier}) $${(producto.priceCents / 100).toFixed(2)}, ${producto.available} disponible(s)\n`);

  const linea = (qty) => [{ productId: producto.id, qty }];
  const esperado = (qty) => tarifa.baseCents + tarifa.additionalItemCents * (qty - 1);
  const gratis = (qty) =>
    libre.enabled &&
    producto.priceCents * qty >= libre.thresholdCents &&
    !(libre.excludedTiers || []).includes(tier) &&
    producto.shipping.freeShippingEligible;

  // --- doméstico ---
  const q1 = await callable('quoteCart', { items: linea(1), country: 'US' });
  eq('1 unidad: subtotal', q1.subtotalCents, producto.priceCents);
  eq(
    `1 unidad: envío ${gratis(1) ? 'gratis por umbral' : 'según tarifa'}`,
    q1.options[0].amountCents,
    gratis(1) ? 0 : esperado(1)
  );

  if (producto.available >= 2) {
    const q2 = await callable('quoteCart', { items: linea(2), country: 'US' });
    eq(
      '2 unidades: base + adicional',
      q2.options[0].amountCents,
      gratis(2) ? 0 : esperado(2)
    );
  }

  // Recogido en persona: solo si está activo en la configuración.
  eq(
    `opciones domésticas (recogido ${config.localPickup.enabled ? 'activo' : 'apagado'})`,
    q1.options.length,
    config.localPickup.enabled && producto.shipping.localPickupEligible ? 2 : 1
  );

  // --- internacional ---
  if (producto.shipping.internationalEligible && config.international.enabled) {
    const banda = Object.entries(config.international.bands).find(([, b]) =>
      b.countries.includes('MX')
    );
    const rateMx = banda?.[1]?.tiers?.[tier];
    if (rateMx) {
      const qmx = await callable('quoteCart', { items: linea(1), country: 'MX' });
      eq('MX: tarifa de la banda', qmx.options[0].amountCents, rateMx.baseCents);
      eq('MX: identifica la banda', qmx.options[0].bandId, banda[0]);
      eq('MX: sin recogido', qmx.options.length, 1);
      // I11: internacional nunca es gratis, suba lo que suba el subtotal.
      eq('MX: envío gratis NO aplica', qmx.options[0].freeShippingApplied, false);
    }
  } else {
    await rejects(
      'no internacional: rechaza con mensaje claro',
      callable('quoteCart', { items: linea(1), country: 'MX' }),
      'Estados Unidos'
    );
  }

  // --- validaciones ---
  await rejects('país sin banda', callable('quoteCart', { items: linea(1), country: 'ES' }),
    'Todavía no enviamos');
  await rejects('producto inexistente',
    callable('quoteCart', { items: [{ productId: 'no-existe', qty: 1 }], country: 'US' }),
    'ya no está disponible');
  await rejects('cantidad inválida',
    callable('quoteCart', { items: [{ productId: producto.id, qty: 0 }], country: 'US' }),
    'no es válida');
  await rejects('sin país', callable('quoteCart', { items: linea(1) }), 'país de entrega');
  // "Solo qued" cubre el singular y el plural: con una unidad el mensaje dice
  // "Solo queda 1", que es como habla una persona.
  await rejects('pedir más de lo que hay',
    callable('createCheckout', { items: linea(producto.available + 5), country: 'US' }),
    'Solo qued');

  if (process.argv.includes('--checkout')) {
    console.log('\n--- createCheckout (reserva stock por 30 min) ---');
    const co = await callable('createCheckout', { items: linea(1), country: 'US' });
    console.log(`orderId: ${co.orderId}`);
    console.log(`URL:     ${co.url}`);
    eq('devuelve URL de Stripe', co.url.startsWith('https://checkout.stripe.com'), true);
  }

  console.log(fails === 0 ? '\nTodo verde.' : `\n${fails} fallas.`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nError inesperado:', error.message);
  process.exit(1);
});
