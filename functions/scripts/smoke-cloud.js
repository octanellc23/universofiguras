/**
 * Prueba de humo contra las funciones YA DESPLEGADAS.
 *
 *   node scripts/smoke-cloud.js              solo cotiza (no toca inventario)
 *   node scripts/smoke-cloud.js --checkout   además crea una sesión real de
 *                                            Stripe en modo prueba y RESERVA
 *                                            stock por 30 minutos
 *
 * Requiere los productos de prueba del seed.
 */
const REGION = 'us-east1';
const PROJECT = process.env.GCLOUD_PROJECT || 'universo-figuras';
const base = `https://${REGION}-${PROJECT}.cloudfunctions.net`;

async function callable(name, data) {
  const res = await fetch(`${base}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
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

const STD = (qty) => [{ productId: 'demo-standard', qty }];
const LARGE = [{ productId: 'demo-large', qty: 1 }];

// El rechazo de un artículo 'heavy' a internacional NO se prueba aquí: no hay
// productos heavy en el catálogo y no vamos a inventar uno solo para el test.
// Esa regla está cubierta sin red en scripts/check-shipping.js.

async function main() {
  console.log(`Contra ${base}\n`);

  // Los precios salen de Firestore, no de aquí (I1).
  const q1 = await callable('quoteCart', { items: STD(3), country: 'US' });
  eq('3 standard: subtotal', q1.subtotalCents, 14997);
  eq('3 standard: envío = 1200 + 400*2', q1.options[0].amountCents, 2000);
  eq('3 standard: ofrece recogido', q1.options.length, 2);
  eq('recogido = $0', q1.options[1].amountCents, 0);

  // Umbral de envío gratis: $150. La figura grande vale $199.99 y sí califica,
  // que es la decisión que tomamos (excludedTiers vacío).
  const q2 = await callable('quoteCart', { items: LARGE, country: 'US' });
  eq('$199.99: envío gratis', q2.options[0].amountCents, 0);
  eq('bandera de envío gratis', q2.options[0].freeShippingApplied, true);

  // I8: en un carrito mezclado gana el tier más alto, no la suma.
  const q2b = await callable('quoteCart', {
    items: [{ productId: 'demo-standard', qty: 1 }, { productId: 'demo-large', qty: 1 }],
    country: 'MX',
  });
  eq('standard + large a MX: tarifa large (5800 + 1500)', q2b.options[0].amountCents, 7300);

  // Justo por debajo del umbral: 2 standard = $99.98
  const q3 = await callable('quoteCart', { items: STD(2), country: 'US' });
  eq('2 standard bajo umbral: cobra 1600', q3.options[0].amountCents, 1600);

  // Internacional
  const q4 = await callable('quoteCart', { items: STD(1), country: 'MX' });
  eq('MX 1 unidad = 4500', q4.options[0].amountCents, 4500);
  eq('MX no ofrece recogido', q4.options.length, 1);
  eq('MX identifica la banda', q4.options[0].bandId, 'band_mx');

  const q5 = await callable('quoteCart', { items: STD(2), country: 'CO' });
  eq('CO banda latam_a, 2 uds = 6500 + 1800', q5.options[0].amountCents, 8300);

  // I11: internacional nunca gratis, aunque supere el umbral
  const q6 = await callable('quoteCart', { items: STD(4), country: 'BR' });
  eq('BR $199.96 NO es envío gratis', q6.options[0].amountCents, 17000);

  await rejects('país sin banda', callable('quoteCart', { items: STD(1), country: 'ES' }),
    'Todavía no enviamos');
  await rejects('producto inexistente', callable('quoteCart', { items: [{ productId: 'no-existe', qty: 1 }], country: 'US' }),
    'ya no está disponible');
  await rejects('cantidad inválida', callable('quoteCart', { items: [{ productId: 'demo-standard', qty: 0 }], country: 'US' }),
    'no es válida');
  await rejects('sin país', callable('quoteCart', { items: STD(1) }),
    'país de entrega');
  // Pedir más de lo que hay. No afirmamos el número exacto: una reserva viva
  // de otra compra cambia el disponible y haría fallar el test sin que nada
  // esté roto.
  await rejects('pedir más de lo que hay', callable('createCheckout', { items: STD(9), country: 'US' }),
    'Solo quedan');

  if (process.argv.includes('--checkout')) {
    console.log('\n--- createCheckout (reserva stock por 30 min) ---');
    const co = await callable('createCheckout', { items: STD(1), country: 'US' });
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
