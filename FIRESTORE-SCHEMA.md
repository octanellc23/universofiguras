# Esquema de Firestore — Universo Figuras

Fuente de verdad del modelo de datos. Si el código y este archivo no coinciden,
uno de los dos es un bug. Ver `CLAUDE.md` para los invariantes que este esquema
existe para sostener.

## Convenciones generales

| Regla | Detalle |
|---|---|
| Dinero | Siempre entero, siempre centavos, siempre sufijo `Cents` (I2). Moneda única: `usd`. |
| Fechas | `Timestamp` de Firestore. Nunca strings ISO, nunca hora del cliente. |
| Peso / medidas | `weightGrams` entero; dimensiones en **milímetros** enteros (I12). El panel los captura en **libras y pulgadas**, que es lo que marcan la balanza y la cinta del dueño; la conversión vive en `src/lib/units.ts` y no en la base. |
| Países | ISO 3166-1 alpha-2 en mayúsculas (`US`, `MX`, `CR`). |
| IDs de documento | Auto-ID de Firestore, salvo donde se indica lo contrario. |
| Campos derivados | Marcados 🔒 — los escribe **solo el Admin SDK** dentro de una transacción. Las reglas prohíben tocarlos desde el navegador, incluso al admin. |
| Borrado | Casi nada se borra. Se archiva (`status: 'archived'`). |

---

## Mapa de colecciones

```
products/{productId}          catálogo — precio, stock, envío, video
videos/{youtubeId}            registro de videos: une producto ↔ post ↔ video
posts/{postId}                blog
config/shipping               tarifas de envío (las edita el dueño)
config/store                  nombre, contacto, políticas (lectura pública)
config/origin                 dirección de despacho (privado)
config/fraud                  umbrales de firma y revisión manual (privado)
orders/{orderId}              pedidos
reservations/{orderId}        reservas de stock con TTL de 30 min
inventoryLedger/{entryId}     bitácora inmutable de movimientos de inventario
stripeEvents/{eventId}        idempotencia de webhooks
```

**Qué NO está en Firestore, a propósito:**

- **El carrito.** Vive en `localStorage` del navegador como
  `{ productId, qty }[]`. No hay documento de carrito porque no hay nada que
  guardar del lado del servidor: el precio y el envío se recalculan en cada
  cotización desde el catálogo (I1). Un carrito persistido sería un lugar más
  donde un precio viejo puede sobrevivir.
- **Cuentas de comprador.** Checkout alojado de Stripe no las necesita. Los
  pedidos se identifican por email. Auth existe solo para el admin.
- **Un contador de número de orden.** Con 200 compradores simultáneos, un
  documento contador es un punto caliente que Firestore serializa a ~1
  escritura/segundo y se convierte en la cola de todo el checkout. El número
  visible se deriva del ID del documento.

---

## `products/{productId}`

ID: auto. El `slug` es un campo aparte para que el dueño pueda corregir una
errata en la URL sin migrar el documento. La unicidad del slug se valida en el
servidor al guardar (consulta previa), Firestore no tiene índices únicos.

```ts
{
  slug: string,                     // "batman-arkham-knight-mcfarlane"
  title: string,                    // "Batman Arkham Knight — McFarlane 7\""
  subtitle: string | null,
  description: string,              // markdown, excluido del índice
  sku: string | null,

  // --- catálogo ---
  manufacturer: string | null,      // "McFarlane Toys"
  line: string | null,              // "DC Multiverse"
  scale: string | null,             // "7 pulgadas"
  condition: 'new' | 'openbox' | 'used',
  categories: string[],             // ["dc", "batman"]
  tags: string[],

  // --- dinero (I2) ---
  priceCents: number,               // 4999 = $49.99
  compareAtPriceCents: number|null, // precio tachado, opcional
  currency: 'usd',
  taxCode: string,                  // Stripe Tax. Default 'txcd_99999999'

  // --- inventario (I3, I4) ---
  stock: number,      // 🔒 unidades físicas en poder del dueño
  reserved: number,   // 🔒 comprometidas en checkouts vivos
  available: number,  // 🔒 = stock - reserved. Denormalizado para consultar.
  inStock: boolean,   // 🔒 = available > 0. Evita la desigualdad en el query.

  // --- envío (I12: weightGrams y dims son OBLIGATORIOS) ---
  shipping: {
    tier: 'standard' | 'large' | 'heavy',
    weightGrams: number,            // obligatorio
    dimsMm: {                       // obligatorio
      length: number,
      width: number,
      height: number
    },
    internationalEligible: boolean, // tier 'heavy' ⇒ SIEMPRE false
    freeShippingEligible: boolean,  // solo aplica a US (I11)
    localPickupEligible: boolean
  },

  fulfillment: {
    handlingDays: number,           // días hábiles hasta despachar
    consolidateHold: boolean,       // esperar y mandar junto con otros pedidos
    preorder: {
      isPreorder: boolean,
      expectedShipDate: Timestamp | null
    }
  },

  // --- contenido (el producto cuelga del video, no al revés) ---
  videoId: string | null,           // ID de YouTube; también clave en videos/
  videoSnapshot: {                  // denormalizado: la ficha no hace 2 lecturas
    title: string,
    thumbUrl: string,
    publishedAt: Timestamp,
    startSeconds: number | null     // dónde empieza la reseña de ESTA figura
  } | null,

  images: [{
    storagePath: string,            // products/{productId}/{file}
    url: string,
    alt: string,
    width: number,
    height: number
  }],                               // images[0] es la principal

  // --- publicación ---
  status: 'draft' | 'active' | 'archived',
  featured: boolean,
  seo: { title: string|null, description: string|null } | null,

  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Timestamp | null,    // null mientras es draft
  createdBy: string                 // uid del admin
}
```

Notas:

- **No hay `stripeProductId` ni `stripePriceId`.** La sesión de Checkout se arma
  con `price_data` en línea desde este documento (I1). No hay catálogo espejo en
  Stripe que se pueda desincronizar.
- `available` e `inStock` son redundantes a propósito: `inStock` permite
  `where('status','==','active').where('inStock','==',true).orderBy('publishedAt','desc')`
  sin la desigualdad que obligaría a ordenar primero por `available`.
- `status: 'active'` con `inStock: false` es un estado válido y deseable: la
  ficha sigue viva (el video la sigue mandando tráfico) mostrando "agotado".

---

## `videos/{youtubeId}`

ID: el ID de YouTube (`dQw4w9WgXcQ`). Une las tres entidades del sitio. Es la
razón de ser del modelo: un video puede reseñar cinco figuras y tener un post.

```ts
{
  youtubeId: string,
  url: string,
  title: string,
  description: string | null,
  thumbUrl: string,
  durationSeconds: number | null,
  publishedAt: Timestamp,
  productIds: string[],             // figuras reseñadas en este video
  postId: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## `posts/{postId}`

```ts
{
  slug: string,
  title: string,
  excerpt: string,
  body: string,                     // markdown, excluido del índice
  coverImage: { storagePath, url, alt, width, height } | null,
  videoId: string | null,
  productIds: string[],             // productos mencionados → bloque de compra
  tags: string[],
  status: 'draft' | 'published' | 'archived',
  seo: { title: string|null, description: string|null, ogImage: string|null },
  readingMinutes: number,
  authorUid: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt: Timestamp | null
}
```

---

## `config/shipping`

**El documento que el dueño edita en enero y en julio** (I10). Lectura pública
(el frontend muestra "envío gratis sobre $150" y los tiempos de entrega);
escritura solo admin.

```jsonc
{
  "version": 1,                    // 🔒 sube en cada guardado; se copia a cada orden
  "currency": "usd",
  "updatedAt": "<Timestamp>",
  "updatedBy": "<uid>",

  "domestic": {
    "country": "US",
    // Flat Rate es independiente de zona: por eso podemos cotizar sabiendo solo
    // el país, que es lo que exige I7.
    "tiers": {
      "standard": {
        "label": "USPS Priority Mail (2-3 días hábiles)",
        "carrier": "USPS",
        "service": "Priority Mail Flat Rate Medium",
        "baseCents": 1200,           // PLACEHOLDER — verificar en Pirate Ship
        "additionalItemCents": 400,
        "deliveryDays": { "min": 2, "max": 3 }
      },
      "large": {
        "label": "USPS Priority Mail (2-3 días hábiles)",
        "carrier": "USPS",
        "service": "Priority Mail Flat Rate Large",
        "baseCents": 1800,
        "additionalItemCents": 500,
        "deliveryDays": { "min": 2, "max": 3 }
      },
      "heavy": {
        "label": "UPS Ground (3-6 días hábiles)",
        "carrier": "UPS",
        "service": "Ground",         // cotizado a Zona 8, la más cara
        "baseCents": 3200,
        "additionalItemCents": 900,
        "deliveryDays": { "min": 3, "max": 6 }
      }
    },
    "freeShipping": {
      "enabled": true,
      "thresholdCents": 15000,       // sobre el subtotal de artículos, sin impuesto
      // Vacío a propósito: el envío gratis aplica a los tres tiers domésticos.
      // El knob queda por si algún día un UPS Ground de $32 no da el margen.
      "excludedTiers": []
    }
  },

  "international": {
    "enabled": true,
    // Solo DHL Express. USPS International está descartado: su tracking muere
    // al entrar al país destino y sin prueba de entrega se pierde cualquier
    // chargeback por "no me llegó". El riesgo real no es el paquete perdido,
    // es la cuenta de Stripe.
    "carrier": "DHL Express",
    // Los tiers 'heavy' NO existen aquí: no son elegibles para internacional.
    "bands": {
      "band_mx": {
        "label": "DHL Express a México (3-5 días hábiles)",
        "countries": ["MX"],
        "tiers": {
          "standard": { "baseCents": 4500, "additionalItemCents": 1200 },
          "large":    { "baseCents": 5800, "additionalItemCents": 1500 }
        },
        "deliveryDays": { "min": 3, "max": 5 }
      },
      "band_latam_a": {
        "label": "DHL Express a Latinoamérica (4-7 días hábiles)",
        "countries": ["CR","PA","GT","SV","HN","NI","DO","CO","EC","PE","CL"],
        "tiers": {
          "standard": { "baseCents": 6500, "additionalItemCents": 1800 },
          "large":    { "baseCents": 8200, "additionalItemCents": 2200 }
        },
        "deliveryDays": { "min": 4, "max": 7 }
      },
      "band_latam_b": {
        "label": "DHL Express a Sudamérica (5-9 días hábiles)",
        "countries": ["BR","AR","UY","PY","BO"],
        "tiers": {
          "standard": { "baseCents": 9500, "additionalItemCents": 2500 },
          "large":    { "baseCents": 11500, "additionalItemCents": 3000 }
        },
        "deliveryDays": { "min": 5, "max": 9 }
      }
    }
  },

  "localPickup": {
    "enabled": true,
    "feeCents": 0,
    // Sin ubicación en la etiqueta: este documento es de lectura pública y la
    // etiqueta se muestra dentro de Stripe. El punto de encuentro se acuerda
    // por email con quien ya compró.
    "label": "Recogido en persona",
    "instructions": "Coordinamos por email después de la compra."
  },

  // En Connecticut el cargo de envío ES gravable cuando el artículo lo es.
  // No es una casilla que se apaga: las shipping_rate van con este tax_code.
  "shippingTaxCode": "txcd_92010001",

  "reservationTtlMinutes": 30       // mínimo que Stripe acepta en expires_at
}
```

### Cómo se calcula (I8, I9)

Una sola función en `functions/src/shipping.ts`, usada por el cotizador del
carrito y por `createCheckout`. Nunca dos implementaciones.

```
rank = { standard: 0, large: 1, heavy: 2 }
tier  = el tier de mayor rank presente en el carrito
units = suma de qty de todas las líneas

shippingCents = tarifa[tier].baseCents
              + tarifa[tier].additionalItemCents * (units - 1)
```

- **Doméstico**: `tarifa = domestic.tiers[tier]`. Si
  `freeShipping.enabled`, el subtotal supera el umbral y el tier no está en
  `excludedTiers` **y todos los artículos tienen `freeShippingEligible`** →
  `shippingCents = 0`.
- **Internacional**: banda = la que contiene el país. Si el carrito contiene
  algún `heavy` → error en español, no un 500. Envío gratis **ni se evalúa**
  (I11).
- **Pickup**: `localPickup.feeCents`. Solo si todos los artículos tienen
  `localPickupEligible`.

Al cotizar se devuelve también `ratesVersion` (= `config/shipping.version`), que
queda grabado en la orden. Así, cuando en enero cambien las tarifas, sigue
siendo posible auditar qué número se le cobró a quién.

---

## `config/store`

Lectura pública. Datos que el frontend muestra y que el servidor usa como
origen de despacho.

```ts
{
  storeName: string,
  supportEmail: string,
  youtubeChannelUrl: string,
  social: { instagram, tiktok, x } ,
  policies: { returnsMarkdown: string, shippingMarkdown: string },
  automaticTaxEnabled: boolean,  // ver nota abajo
  updatedAt: Timestamp
}
```

`automaticTaxEnabled` en `false` crea las sesiones de Stripe **sin cálculo de
impuesto**. Existe para poder desarrollar antes de cargar la dirección fiscal
en Stripe: con `automatic_tax` encendido y sin dirección, Stripe rechaza *toda*
sesión. **Debe estar en `true` antes de la primera venta real.** Si falta el
campo, el código asume `true`: equivocarse hacia cobrar de más se corrige con
un reembolso, equivocarse hacia no cobrar lo paga el dueño.

## `config/origin`

Dirección desde donde se despacha. **Documento aparte y privado a propósito**:
`config/store` es de lectura pública porque el frontend saca de ahí el nombre y
las políticas, y la dirección de casa del dueño no tiene por qué viajar en el
bundle de nadie. Las reglas solo dejan leer `shipping` y `store` sin ser admin.

```ts
{
  line1: string,
  line2: string | null,
  city: string,
  state: string,
  postalCode: string,
  country: string,
  updatedAt: Timestamp
}
```

## `config/fraud`

**Privado** (lectura denegada al cliente): publicar el umbral de revisión manual
es decirle al defraudador cuánto puede gastar sin que nadie lo mire.

```ts
{
  signatureRequiredAboveCents: 15000,   // $150, configurable
  manualReviewAboveCents: 30000,        // marca flags.manualReview, NO bloquea
  // Coleccionable caro + tarjeta internacional + dirección de reenvío es el
  // patrón que marca Radar. La política es revisión manual, no bloqueo:
  // bloquear automáticamente le cuesta ventas legítimas a un negocio cuyo
  // público es justamente internacional.
  manualReviewIfBillingCountryDiffers: true,
  updatedAt: Timestamp
}
```

---

## `orders/{orderId}`

ID: auto. `orderId` se manda a Stripe como `client_reference_id` y en
`metadata.orderId`, y es el mismo ID que usa `reservations/{orderId}` — un solo
identificador para toda la cadena.

```ts
{
  number: string,                   // "UF-7KQ3M2" derivado del ID, para humanos
  status: 'pending_payment' | 'paid' | 'fulfilled'
        | 'expired' | 'canceled' | 'refunded' | 'partially_refunded',

  // Snapshot: el precio de HOY, no el que tenga el producto mañana.
  items: [{
    productId: string,
    slug: string,
    title: string,
    imageUrl: string | null,
    unitPriceCents: number,
    qty: number,
    lineTotalCents: number,
    shippingTier: 'standard' | 'large' | 'heavy',
    weightGrams: number
  }],

  subtotalCents: number,
  shippingCents: number,
  taxCents: number,                 // lo llena el webhook, lo calcula Stripe Tax
  discountCents: number,
  totalCents: number,
  amountRefundedCents: number,
  currency: 'usd',

  shippingQuote: {                  // cómo se llegó a shippingCents (auditoría)
    method: 'domestic' | 'international' | 'pickup',
    country: string,                // 'US', 'MX', ...
    bandId: string | null,          // solo internacional
    tier: 'standard' | 'large' | 'heavy',
    units: number,
    baseCents: number,
    additionalItemCents: number,
    freeShippingApplied: boolean,
    rateLabel: string,
    ratesVersion: number            // = config/shipping.version
  },
  pickupOffered: boolean,           // se ofreció recogido además del envío

  customer: {                       // lo llena Stripe al completar
    email: string | null,
    name: string | null,
    phone: string | null
  },
  shippingAddress: { line1, line2, city, state, postalCode, country } | null,
  billingCountry: string | null,

  stripe: {
    sessionId: string,
    paymentIntentId: string | null,
    expiresAt: Timestamp,           // +30 min
    hostedUrl: string | null
  },

  signatureRequired: boolean,       // totalCents > config/fraud
  flags: {
    manualReview: boolean,
    oversold: boolean,              // cobró sin inventario: lo resuelve una persona
    disputed: boolean,
    reasons: string[]               // ['high_value', 'billing_country_mismatch']
  },
  consolidateHold: boolean,         // algún ítem lo pidió

  fulfillment: {
    carrier: string | null,
    trackingNumber: string | null,
    trackingUrl: string | null,
    shippedAt: Timestamp | null,
    deliveredAt: Timestamp | null,
    notes: string | null
  },

  createdAt: Timestamp,
  updatedAt: Timestamp,
  paidAt: Timestamp | null,
  processedEventIds: string[]       // trazabilidad con stripeEvents
}
```

### Máquina de estados

```
                 crea sesión
                      │
                      ▼
             pending_payment ──── checkout.session.expired ──▶ expired
                      │            (o el barrido programado)
                      │                     libera reserva
   checkout.session.completed
      descuenta stock (I3)
                      │
                      ▼
                    paid ──── envío + tracking ──▶ fulfilled
                      │
                      └──── charge.refunded ──▶ refunded | partially_refunded
```

`pending_payment` es el **único** estado en que existe una reserva activa.

---

## `reservations/{orderId}`

ID = `orderId`. Un pedido, una reserva. Existe para que 200 personas entrando en
5 minutos sobre 3 unidades no vendan 40 (I4).

```ts
{
  orderId: string,
  sessionId: string,
  status: 'active' | 'consumed' | 'released',
  items: [{ productId: string, qty: number }],
  expiresAt: Timestamp,             // creación + 30 min + 2 min de gracia
  releaseReason: 'expired' | 'stripe_expired' | 'canceled' | null,
  createdAt: Timestamp,
  consumedAt: Timestamp | null,
  releasedAt: Timestamp | null
}
```

### Ciclo de vida del inventario

| Momento | `stock` | `reserved` | `available` | Reserva |
|---|---|---|---|---|
| Producto en catálogo | 3 | 0 | 3 | — |
| `createCheckout` (2 uds) | 3 | **2** | **1** | `active` |
| `checkout.session.completed` | **1** | **0** | 1 | `consumed` |
| `checkout.session.expired` | 3 | **0** | **3** | `released` |
| Barrido programado (red de seguridad) | 3 | **0** | **3** | `released` |

Lo importante de esa tabla: `stock` **solo** baja en la fila del pago (I3), y
`available` **no se mueve** al confirmar el pago, porque ya se había descontado
al reservar. Todas las escrituras van en la misma transacción que actualiza la
reserva, y siempre leyendo todos los productos antes de escribir ninguno (I13).

La **función programada** (`releaseExpiredReservations`, cada 5 min) consulta
`status == 'active' && expiresAt <= now` y libera. No sustituye al webhook
`checkout.session.expired`: lo respalda. Si Stripe no nos avisa, o el webhook
falla tres veces, el inventario igual vuelve al catálogo. Los 2 minutos de
gracia evitan liberar una reserva mientras Stripe todavía está procesando un
pago que entró en el segundo 29:58.

---

## `inventoryLedger/{entryId}`

Bitácora inmutable. No es opcional: cuando el dueño diga "me faltó una figura",
esto es lo que responde qué pasó y cuándo.

```ts
{
  productId: string,
  type: 'reserve' | 'release' | 'sale' | 'restock' | 'adjust',
  qty: number,                      // siempre positivo; el signo lo da 'type'
  stockAfter: number,
  reservedAfter: number,
  orderId: string | null,
  actor: 'system' | 'webhook' | 'scheduler' | `admin:${string}`,
  note: string | null,
  createdAt: Timestamp
}
```

---

## `stripeEvents/{eventId}`

ID = `event.id` de Stripe. Se escribe con **`.create()`, nunca `.set()`** (I5):
si el documento ya existe, `.create()` falla y esa falla *es* la señal de "ya
procesé este evento, respondo 200 y salgo". Stripe reintenta hasta 3 días; sin
esto, un reintento descuenta inventario dos veces.

```ts
{
  type: string,                     // 'checkout.session.completed'
  status: 'processing' | 'done' | 'error',
  orderId: string | null,
  livemode: boolean,
  stripeCreatedAt: Timestamp,
  receivedAt: Timestamp,
  processedAt: Timestamp | null,
  error: string | null,
  expireAt: Timestamp               // TTL a 90 días (política en los índices)
}
```

El TTL de 90 días está declarado en `firestore.indexes.json` (`fieldOverrides`
→ `ttl: true`). Stripe deja de reintentar a los 3 días, así que 90 es holgura
para depurar sin acumular basura para siempre.

---

## Consultas previstas e índices

| Consulta | Índice |
|---|---|
| Catálogo, más recientes | `status`, `publishedAt ↓` |
| Catálogo, solo disponibles | `status`, `inStock`, `publishedAt ↓` |
| Destacados | `status`, `featured`, `publishedAt ↓` |
| Figuras de un video | `status`, `videoId`, `publishedAt ↓` |
| Por etiqueta | `status`, `tags ⊇`, `publishedAt ↓` |
| Por categoría, por precio | `status`, `categories ⊇`, `priceCents ↑` |
| Blog publicado | `status`, `publishedAt ↓` |
| Posts de un producto | `status`, `productIds ⊇`, `publishedAt ↓` |
| Pedidos por estado (admin) | `status`, `createdAt ↓` |
| Pedidos de un comprador | `customer.email`, `createdAt ↓` |
| **Reservas vencidas (scheduler)** | `status`, `expiresAt ↑` |
| Historial de un producto | `productId`, `createdAt ↓` |

Excluidos del índice por tamaño: `products.description`, `posts.body`.

---

## Resumen de acceso (ver `firestore.rules`)

| Colección | Público | Admin (navegador) | Admin SDK |
|---|---|---|---|
| `products` | lee si `status=='active'` | lee/escribe **salvo** 🔒 | todo |
| `posts` | lee si `status=='published'` | todo | todo |
| `videos` | lee | todo | todo |
| `config/shipping`, `config/store` | lee | todo | todo |
| `config/origin`, `config/fraud` | ✗ | todo | todo |
| `orders` | ✗ | solo lee | todo |
| `reservations` | ✗ | solo lee | todo |
| `inventoryLedger` | ✗ | solo lee | todo |
| `stripeEvents` | ✗ | ✗ | todo |

El Admin SDK ignora las reglas; por eso los campos de inventario están
bloqueados incluso para el admin en el navegador. Reponer stock pasa por la
callable `adjustStockLevel`, que mantiene `stock`/`reserved`/`available`/`inStock`
coherentes en una transacción y deja rastro en `inventoryLedger`.
