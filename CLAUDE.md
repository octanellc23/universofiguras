# Universo Figuras — memoria del proyecto

Este archivo es la memoria entre sesiones. Si algo aquí contradice lo que estás
a punto de hacer, gana este archivo. Si tomas una decisión nueva que afecte
arquitectura, dinero, inventario o envíos, **actualiza este archivo en el mismo
commit**.

---

## 1. Qué estamos construyendo

Tienda de figuras de acción coleccionables **con blog integrado**, para un
youtuber en Connecticut, EEUU.

El orden mental correcto es: **es un canal de contenido que además vende**, no
una tienda que tiene blog. Cada producto está amarrado al video de reseña donde
aparece. El video es el que genera la demanda; la ficha de producto es el cierre
de esa demanda.

Consecuencias de diseño que salen de esto y que NO son negociables:

- Un producto sin video enlazado es un caso raro, no el caso normal.
- El tráfico llega **en picos**: publica un video y entran 200 personas en 5
  minutos sobre 3 unidades de stock. Todo el diseño de inventario existe para
  sobrevivir ese pico sin vender de más. Ver invariante 3 y 4.
- El blog y los productos comparten la entidad `video`. Ver `FIRESTORE-SCHEMA.md`.

### El dueño no es técnico

Este es un requisito funcional, no una nota simpática. El dueño tiene que poder,
él solo y sin desplegar nada:

- Añadir un producto: fotos, link al video, precio, descripción, peso y medidas.
- Cambiar las tarifas de envío (USPS sube precios en enero y julio).
- Ajustar el umbral de firma requerida y el de envío gratis.
- Marcar un pedido como enviado y pegar el tracking.

Cualquier cosa que lo obligue a editar código o pedir un despliegue está mal
diseñada. Por eso las tarifas viven en Firestore (`config/shipping`) y no en
constantes de TypeScript.

---

## 2. Stack — decisiones cerradas, no las revisites

| Pieza | Decisión |
|---|---|
| Frontend | Next.js **App Router** |
| Hosting | Firebase **App Hosting** (SSR sobre Cloud Run). **NO** Hosting clásico. |
| Base de datos | Firestore (modo nativo) |
| Archivos | Cloud Storage |
| Auth | Firebase Auth + custom claim `admin: true` |
| Backend | Cloud Functions **v2** en TypeScript |
| Pagos | **Stripe Checkout** (sesión alojada). NO Elements. |
| Impuestos | Stripe Tax |

Descartados explícitamente, no los propongas de nuevo: **Shopify**,
**WooCommerce**, Hosting clásico de Firebase, Stripe Elements, USPS
International (ver §5.3).

---

## 3. Invariantes

Romper uno de estos es un bug de severidad alta, aunque el código compile y los
tests pasen.

### 3.1 Dinero y precios

**I1 — El precio NUNCA viaja desde el navegador.**
El frontend manda `{ productId, qty }[]` y un código de país. Todo lo demás
—precio unitario, envío, elegibilidad, impuestos— se lee de Firestore en el
servidor. Si ves un `priceCents` llegando en el body de un request, es un
agujero de seguridad, no una optimización.

Corolario: la sesión de Checkout se arma con `price_data` en línea, construido
en el servidor desde el documento de Firestore. No mantenemos precios espejo en
Stripe, no hay que sincronizar nada.

**I2 — Todo el dinero en centavos, enteros. Nunca floats.**
`priceCents`, `shippingCents`, `taxCents`, `totalCents`. Nunca `19.99`. Los
nombres de campo llevan el sufijo `Cents` justamente para que un `* 100` de más
salte a la vista en el diff.

### 3.2 Inventario

**I3 — El stock se descuenta en el webhook (`checkout.session.completed`),
NUNCA al crear la sesión.**
Un carrito abandonado no debe consumir inventario permanentemente.

**I4 — La reserva SÍ ocurre al crear la sesión, con expiración de 30 min.**
30 minutos es el mínimo que Stripe permite en `expires_at`. Mecánica:

- Colección `reservations/{orderId}`.
- En el producto conviven `stock` (unidades físicas), `reserved` (unidades
  comprometidas en checkouts vivos) y `available` (denormalizado, `stock - reserved`).
- Crear sesión → transacción que sube `reserved` y baja `available`.
- Pago confirmado → transacción que baja `stock` y `reserved` (el `available` no
  se mueve: ya estaba descontado).
- Expiración/cancelación → transacción que baja `reserved` y sube `available`.
- **Función programada** que libera reservas vencidas como red de seguridad, por
  si `checkout.session.expired` nunca llega.

Sin esto, 200 personas entrando a la vez sobre 3 unidades venden 40.

**I3 + I4 juntos:** `reserved` sube al crear la sesión, `stock` solo baja con
dinero cobrado. No los confundas.

### 3.3 Stripe

**I5 — Idempotencia por `event.id` en `stripeEvents/{eventId}` usando
`.create()`, no `.set()`.**
`.create()` falla si el documento ya existe; eso es exactamente la señal de
"este evento ya lo procesé, salgo con 200". Stripe reintenta webhooks. Sin esto
descuentas inventario doble.

**I6 — El webhook usa `req.rawBody` y NO lleva body parser.**
Nada de `express.json()`. Cualquier parser destruye la verificación de firma
(`stripe.webhooks.constructEvent`). En Functions v2 se usa `onRequest` y se lee
`req.rawBody`.

**I7 — `shipping_options` se fija al crear la sesión y Stripe no lo recalcula.**
Cuando el comprador escribe su dirección dentro de Checkout, Stripe **no**
vuelve a preguntarnos el costo de envío. Por eso:

- El país se pide **en nuestro sitio, ANTES** de crear la sesión.
- `shipping_address_collection.allowed_countries` se restringe a **ese único
  país**, para que no pueda cambiarlo dentro de Checkout y pagar un envío que no
  corresponde.
- No intentes recalcular después. No se puede sin migrar a Elements, y Elements
  está descartado.

### 3.4 Envío

**I8 — El envío del carrito = tier más alto + incremento por artículo adicional.**
NO la suma de los envíos individuales. Nadie paga $54 de shipping por tres
figuras.

```
shipping = tarifa[tierMásAltoDelCarrito].base
         + tarifa[tierMásAltoDelCarrito].adicional * (unidadesTotales - 1)
```

Orden de tiers: `standard` < `large` < `heavy`.

**I9 — El cotizador del carrito y `createCheckout` deben dar SIEMPRE el mismo
número.** Una sola función compartida (`shipping.ts`), no dos implementaciones
que "casualmente" coinciden. Si un día divergen, el comprador ve un precio en el
carrito y otro en Stripe, y eso es una disputa servida.

**I10 — Las tarifas viven en Firestore (`config/shipping`), no en el código.**
USPS sube precios en enero y julio y el dueño tiene que ajustarlos sin
desplegar.

**I11 — Envío gratis NUNCA aplica a internacional.** $95 de DHL se come el
margen completo. La regla vive en el código de cálculo, no solo en la config: si
el destino no es US, el umbral de envío gratis ni se evalúa.

**I12 — `weightGrams` y las dimensiones son campos OBLIGATORIOS en el formulario
de producto**, aunque hoy usemos tarifa plana. El día que integremos Shippo o
EasyPost para tarifas reales, medir 200 cajas hacia atrás es un infierno. Se
capturan desde el día uno.

El panel los pide en **libras y pulgadas** —lo que marcan la balanza y la cinta
del dueño— y los guarda en gramos y milímetros enteros. Un solo sistema
canónico en la base, igual que el dinero en centavos; la conversión vive en
`src/lib/units.ts`, que es la única frontera. No repartas conversiones por el
código.

### 3.5 Transacciones

**I13 — En toda transacción de Firestore: TODAS las lecturas antes de TODAS las
escrituras.** Firestore lo exige; el SDK falla en runtime, no en compilación.
Cuando reserves N productos, lee los N documentos primero, valida, y recién
entonces escribe.

---

## 4. Modelo de envío

Los números son **placeholder**. Hay que verificarlos en Pirate Ship antes de
cobrar de verdad. Se cambian en Firestore, no aquí.

### 4.1 Doméstico (EEUU) — tres tiers por producto

| Tier | Servicio | Base | Artículo extra |
|---|---|---|---|
| `standard` | USPS Priority Mail Flat Rate **Medium** | ~$12.00 | +$4.00 |
| `large` | USPS Priority Mail Flat Rate **Large** | ~$18.00 | +$5.00 |
| `heavy` | UPS Ground (tarifa calculada a **Zona 8**) | ~$32.00 | +$9.00 |

Flat Rate es independiente de zona: el mismo precio a Hawái que al pueblo de al
lado. Por eso encaja con I7 — podemos cotizar sabiendo solo el país, sin
código postal. `heavy` se cotiza a Zona 8 (la más cara) precisamente para que
tampoco dependa de la zona real.

**`heavy` es una válvula de escape, no un tier de uso diario.** Lo que vende
son figuras: casi todo cae en `standard` y alguna caja grande en `large`. El
tier se queda en el código y en `config/shipping` sin costo alguno, para el día
que aparezca una estatua o un diorama que no entre en una caja Flat Rate. Si se
hubiera eliminado, ese día habría que volver a tocar código —y además
desaparecería la regla de que lo pesado no sale del país, dejando todo elegible
para internacional sin querer.

### 4.2 Internacional (Latinoamérica) — bandas por país, solo DHL Express

| Banda | Países |
|---|---|
| `band_mx` | MX |
| `band_latam_a` | CR PA GT SV HN NI DO CO EC PE CL |
| `band_latam_b` | BR AR UY PY BO |

**Por qué solo DHL y no USPS International:** no es por precio. El tracking de
USPS International muere al entrar al país destino. Sin prueba de entrega se
pierde **automáticamente** cualquier chargeback por "no me llegó". Y una tasa
alta de disputas puede costarle la cuenta de Stripe — lo que le tumbaría también
las ventas domésticas, que son la mayoría del negocio. El riesgo no es el envío
perdido, es la cuenta de pagos.

Reglas:

- Los productos con tier **`heavy` no son elegibles para internacional**. Las
  bandas internacionales solo definen tarifas para `standard` y `large`.
- Envío gratis nunca aplica (I11).
- Si el carrito mezcla un `heavy` con destino internacional, el cotizador
  rechaza con un mensaje claro en español, no con un 500.

### 4.3 Otros

- **Recogido en persona**: $0, configurable (`config/shipping.localPickup`).
  Es una opción de envío más, con su propia `shipping_option` en Stripe.
- **`fulfillment.consolidateHold`**: existe para que un comprador que pide
  varias figuras (a veces en pedidos distintos, a veces esperando un preorder)
  las reciba juntas en un solo paquete.

---

## 5. Impuestos

**Stripe Tax activo.**

En Connecticut, el cargo de envío **ES gravable** cuando el artículo lo es. No
es un campo que se exenta ni una casilla que se apaga: las `shipping_rate`
llevan `tax_code: txcd_92010001` (shipping) y Stripe hace el resto. Los
productos llevan su propio `tax_code` (por defecto
`txcd_99999999`, tangible goods, configurable por producto).

Si alguna vez ves envío cotizando con impuesto $0 en una orden de CT, algo se
rompió.

---

## 6. Disputas y fraude

- **Firma requerida sobre $150** (configurable, `config/fraud`). Es artículo de
  alto valor y "no me llegó" es la disputa más común del rubro. La firma es la
  prueba que gana el chargeback.
- **Patrón de riesgo conocido:** coleccionable caro + tarjeta internacional +
  dirección de reenvío (freight forwarder). Es exactamente lo que marca Radar.
- **La política es revisión manual sobre cierto monto, NO bloqueo automático.**
  Bloquear automáticamente le cuesta ventas legítimas a un negocio cuyo público
  es justamente internacional. Se marca el pedido con
  `flags.manualReview = true` y el dueño decide.

---

## 7. Convenciones de código

- **TypeScript estricto.** Sin `any`, salvo casts puntuales de tipos de Stripe
  (la librería tiene uniones que no siempre se estrechan bien). Cuando toque,
  cast localizado y comentado, no `any` regado.
- **Errores al cliente vía `HttpsError`**, en **español** y entendibles por un
  comprador: `"Solo quedan 2 de Batman Arkham Knight"`, no
  `"FAILED_PRECONDITION: insufficient reserved stock"`. El detalle técnico va al
  log, no al comprador.
- **Comentarios en español explicando el POR QUÉ, no el qué.**
  Mal: `// incrementa reserved`. Bien: `// reservamos aquí y no al pagar porque
  entre la sesión y el pago pasan minutos y el video sigue corriendo`.
- **Transacciones de Firestore:** todas las lecturas antes de las escrituras (I13).
- **Secretos con `defineSecret`**, nunca en el código ni en `.env` versionado.
  Secretos actuales: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Timestamps**: `Timestamp` de Firestore, nunca strings ISO ni `Date.now()`
  del cliente. La hora la pone el servidor.
- **IDs de pedido**: no usamos un contador incremental en un documento único —
  con 200 compradores simultáneos ese documento es un punto caliente y Firestore
  lo serializa. El número visible al humano se deriva del ID del documento.

---

## 8. Estructura del repositorio

```
/CLAUDE.md               este archivo
/ENTREGA.md              qué falta para entregar al cliente y quién lo hace
/FIRESTORE-SCHEMA.md     esquema de datos, fuente de verdad del modelo
/firebase.json           firestore + storage + functions + emuladores
/firestore.rules         reglas de seguridad (Firestore)
/storage.rules           reglas de seguridad (Storage)
/firestore.indexes.json  índices compuestos
/apphosting.yaml         config del backend de App Hosting (Next.js SSR)
/functions/              Cloud Functions v2 (TypeScript)
  src/
    index.ts             puntos de entrada exportados
    options.ts           setGlobalOptions — se importa PRIMERO, siempre
    firebase.ts          initializeApp + db + nombres de colección
    types.ts             tipos del dominio
    config.ts            lectura de config/shipping y config/fraud
    catalog.ts           validación del carrito + carga de precios (I1)
    shipping.ts          cálculo de envío COMPARTIDO (I8, I9, I11)
    inventory.ts         reservar / liberar / consumir / ajustar stock
    stripe.ts            cliente de Stripe + secretos
    checkout.ts          quoteCart + createCheckout (callables)
    webhook.ts           stripeWebhook (onRequest, rawBody, sin parser)
    scheduled.ts         releaseExpiredReservations (cada 5 min)
    admin.ts             adjustStockLevel (callable, solo admin)
  scripts/
    check-shipping.js    verifica I8/I9/I11 sin dependencias: npm run check:shipping
    smoke-cloud.js       verifica las funciones YA desplegadas
    seed-firestore.js    siembra config/* y productos demo
    set-admin.js         otorga el claim admin:true a un correo
/src/                    Next.js App Router
  app/
    layout.tsx           raíz mínima (html/body). NADA de chrome aquí
    (site)/              la tienda: header + carrito + footer
      page.tsx           home: hero + rejilla
      producto/[slug]/   ficha: video, buybox, especificaciones
      carrito/           page.tsx (servidor) + CartClient.tsx (cliente)
      pedido/[orderId]/  confirmación (success_url de Stripe)
      blog/              listado + [slug]
    admin/
      login/             fuera del grupo protegido, si no se redirige solo
      (panel)/           layout con requireAdmin() + barra del panel
        page.tsx         resumen: por despachar, agotadas, revisar
        productos/       lista + [id] formulario (id "nuevo" = alta)
        pedidos/         lista de pedidos
      actions.ts         server actions ('use server')
    api/admin/session/   convierte el ID token en cookie httpOnly
  components/            Header, ProductCard, StockBadge, AddToCart, VideoBlock
  lib/
    money.ts             centavos → texto. ÚNICA frontera de conversión
    types.ts             tipos de vista
    server/admin.ts      firebase-admin (ADC) para componentes de servidor
    server/catalog.ts    lectura de productos, países, pedidos
    server/blog.ts       lectura de posts
    client/firebase.ts   SDK de cliente + callables (región us-east1)
    client/cart.tsx      carrito en localStorage: SOLO {productId, qty}
```

### Reglas del frontend

- **Todas las páginas son `force-dynamic`.** Cachear el catálogo mostraría
  "disponible" sobre unidades que ya se fueron; con 200 personas entrando a la
  vez eso es sobreventa garantizada.
- **El carrito guarda solo `{productId, qty}`** (I1). Los títulos y precios que
  se pintan en `/carrito` vienen de la respuesta de `quoteCart`, no de
  localStorage: un carrito viejo no puede resucitar un precio viejo.
- **El servidor lee con `firebase-admin`**, no con el SDK de cliente. En App
  Hosting las credenciales las pone Cloud Run; en local salen de
  `gcloud auth application-default login`.
- `.env.local` tiene las claves públicas para `npm run dev`; en producción las
  mismas salen de `apphosting.yaml`.

### Funciones desplegadas

| Función | Tipo | Qué hace |
|---|---|---|
| `quoteCart` | callable | Cotiza el carrito. Misma función de envío que el checkout (I9). |
| `createCheckout` | callable | Reserva stock (I4) → crea la sesión de Stripe → devuelve la URL. |
| `stripeWebhook` | onRequest | `rawBody`, idempotente por `event.id` (I5, I6). Aquí baja el stock (I3). |
| `releaseExpiredReservations` | scheduler | Red de seguridad: libera reservas vencidas cada 5 min. |
| `adjustStockLevel` | callable | Reposición manual. Único camino para tocar `stock`. |

### Antes de que funcione en un proyecto nuevo

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Y crear a mano el documento `config/shipping` — el JSON completo, listo para
copiar, está en `FIRESTORE-SCHEMA.md`. Sin ese documento el checkout responde
"la tienda está en mantenimiento" y nada más.

---

## 9. Orden de trabajo y estado

1. ✅ `CLAUDE.md`
2. ✅ Andamiaje (`firebase.json`, reglas, índices, `functions/`)
3. ✅ Esquema de Firestore → `FIRESTORE-SCHEMA.md`
4. ✅ Lógica de envío (`shipping.ts`) — 17 verificaciones en `check-shipping.js`
5. ✅ `createCheckout` + webhook de Stripe
6. ✅ Compila limpio (`tsc` estricto, sin `any` salvo el cast documentado de
   `shipping_details` en `webhook.ts`)

### Estado del despliegue (29 jul 2026)

Proyecto `universo-figuras`, plan Blaze. Cuenta del CLI: `edgardoj2305@gmail.com`
(la misma que necesita ADC: `gcloud auth application-default login`).

| Pieza | Estado |
|---|---|
| Firestore `us-east1`, nativo, Standard | desplegado |
| Reglas, 13 índices, TTL de `stripeEvents` | desplegado |
| 5 funciones, Node 22, 2ª gen, `us-east1` | desplegado |
| `config/*` y 2 productos demo | sembrados (`npm run seed`) |
| Frontend Next.js (tienda, ficha, carrito, blog, confirmación) | desplegado |
| Panel `/admin` (figuras, inventario, pedidos, despacho) | desplegado |
| Barrido programado | corre cada 5 min, verificado en los logs |
| App Hosting backend `universofiguras` (`us-east4`) | desplegado |
| Repositorio | `github.com/octanellc23/universofiguras` (privado) |
| Dominio `universofiguras.com` | **pendiente de conectar** |

URL provisional: `https://universofiguras--universo-figuras.us-east4.hosted.app`

**El despliegue del sitio va desde el código local, no desde GitHub.** El
backend se creó sin repositorio conectado, y `firebase.json` tiene el bloque
`apphosting` que habilita la subida local:

```bash
firebase deploy --only apphosting
```

Un push a `main` NO despliega nada. Si algún día se conecta el repositorio en
la consola, eso cambia y cada push pasa a ser un despliegue a producción.

**Dos trampas ya pisadas, para no repetirlas:**

- El asistente de la consola **sobrescribe `apphosting.yaml`** con una
  plantilla vacía. Si el carrito o el login dejan de funcionar en producción
  con un error de Firebase sin configurar, revisa que el bloque `env` siga ahí.
- En `.gitignore`, un patrón como `lib/` **sin barra inicial** coincide con
  cualquier carpeta a cualquier profundidad. Se llevó `src/lib/` entero y nada
  avisó hasta que el build en la nube falló con "Module not found". Los
  patrones de salida de build van anclados a la raíz.
| Webhook URL | `https://us-east1-universo-figuras.cloudfunctions.net/stripeWebhook` |
| Endpoint registrado en Stripe + `whsec` real | **pendiente** |
| Dirección fiscal y registro de CT en Stripe Tax | **pendiente** — sin la dirección, `automatic_tax` rechaza toda sesión; sin el registro, cobra $0 en silencio |

Verificaciones que se corren solas:

```bash
cd functions && npm run check:shipping     # 17 checks del cotizador, sin red
```

```bash
cd functions && node scripts/smoke-cloud.js   # 18 checks contra lo desplegado
```

`smoke-cloud.js --checkout` además crea una sesión real de Stripe en modo
prueba y reserva stock 30 minutos.

### Para retomar mañana

En orden de importancia:

1. **Panel de admin.** Es el requisito de fondo del proyecto: que el dueño
   cargue productos solo. Evaluar **FireCMS** antes de escribir un CRUD a mano.
2. **Cerrar el ciclo de pago.** Registrar el endpoint del webhook en Stripe
   (los 4 eventos), actualizar `STRIPE_WEBHOOK_SECRET`, redesplegar, y pagar
   una sesión de prueba con `4242 4242 4242 4242` para ver bajar el stock.
3. **Stripe Tax**, cuando se decida retomarlo: dirección fiscal + registro de
   CT, y `config/store.automaticTaxEnabled` a `true`.
4. Fotos y videos reales en los productos.

Cosas que el sitio NO debe decir: **nunca mencionar Connecticut ni la
ubicación** en texto visible para el comprador. La dirección de despacho vive
en `config/origin`, que es privado. Los comentarios internos sí la mencionan
porque de ahí depende la lógica fiscal.

## 9b. Panel de admin — por qué propio y no FireCMS

**Evaluado el 29 jul 2026. Decisión: admin propio dentro del Next.js.**

FireCMS Community es gratis (MIT) y PRO cuesta €149.99/proyecto/mes, así que el
precio no era el problema. El problema es arquitectónico: **FireCMS escribe a
Firestore desde el navegador con el SDK de cliente**, o sea que está sujeto a
`firestore.rules`. Y nuestras reglas prohíben al navegador —admin incluido—
tocar `stock`, `reserved`, `available` e `inStock`, porque son campos derivados
que solo deben moverse en transacción.

Consecuencia: FireCMS no funciona de fábrica aquí. Al crear un producto, la
regla exige `available == stock && reserved == 0`; habría que escribir campos
personalizados en React para calcularlos, y una *entity action* para llamar a
`adjustStockLevel`. Es código propio igual, pero peleando contra nuestro propio
modelo de seguridad.

El admin propio se apoya en él: **los componentes de servidor escriben con
`firebase-admin`, que ignora las reglas**, y el inventario sigue pasando por la
callable. Un repositorio, un despliegue, una autenticación.

### Cómo funciona la sesión del panel

- Login con Firebase Auth (email/contraseña) del lado del cliente.
- El ID token se manda a `POST /api/admin/session`, que **verifica el claim
  `admin: true`** y solo entonces escribe una cookie httpOnly. La cookie no
  significa "iniciaste sesión", significa "eres admin".
- Los componentes de servidor leen esa cookie y la verifican con
  `verifyIdToken`. **No usamos `createSessionCookie`** a propósito: esa API
  firma con la cuenta de servicio y necesita permiso de firma que no está
  garantizado ni en local ni en Cloud Run. Verificar un token no firma nada.
- Los tokens caducan en una hora; `AdminSessionSync` los renueva y reescribe la
  cookie. Sin eso, el dueño perdería el formulario a medio llenar.
- Las fotos se suben **directo del navegador a Storage** (las server actions
  tienen un límite de 1 MB en el body y una foto de celular pesa cuatro veces
  eso). Ahí sí mandan `storage.rules`, que exigen el mismo claim.

Dar permiso a alguien:

```bash
cd functions && node scripts/set-admin.js correo@ejemplo.com
```

## 10. Pendiente para después — NO lo hagas ahora

- **Panel de admin.** Cuando lleguemos, **evaluar FireCMS antes de escribirlo a
  mano**. El dueño no es técnico; una herramienta ya hecha probablemente le
  sirva mejor que un CRUD nuestro. Es lo que falta para que pueda cargar
  productos él solo, que es el requisito de fondo del proyecto.
- **Emails transaccionales** (confirmación, envío, tracking).
- Integración de tarifas reales (Shippo/EasyPost) — para eso capturamos peso y
  dimensiones desde ya (I12).
