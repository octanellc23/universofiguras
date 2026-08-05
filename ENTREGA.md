# Entrega — Universo Figuras

Tienda de figuras coleccionables y prints de **Lokillo's Hidden Gems**.

Este documento es la lista de lo que falta para que el negocio sea del cliente
y pueda cobrar dinero real. Está ordenado por urgencia, y cada punto dice
**quién** lo hace, porque varios no los puede hacer nadie más que él.

Para el detalle técnico —por qué las cosas están hechas como están— ver
`CLAUDE.md`. Para el modelo de datos, `FIRESTORE-SCHEMA.md`.

---

## 1. Dónde vive todo

| Pieza | Dónde | Dueño hoy |
|---|---|---|
| Sitio | https://universofiguras.com | — |
| Panel | https://universofiguras.com/admin | — |
| Proyecto Firebase / Google Cloud | `universo-figuras` | cuenta del desarrollador |
| Repositorio | `github.com/octanellc23/universofiguras` (privado) | cuenta del desarrollador |
| Stripe | cuenta de pruebas del desarrollador | **hay que cambiarla** |
| Resend (correos) | cuenta creada a nombre del cliente | del cliente |
| Dominio | registrador donde se compró | — |

URL de respaldo si el dominio falla:
`https://universofiguras--universo-figuras.us-east4.hosted.app`

---

## 2. Qué funciona hoy

Probado de punta a punta con pagos reales en modo prueba:

- Catálogo, ficha con video, carrito con selector de país, pago por Stripe.
- **Reserva de inventario**: al iniciar el pago se aparta la unidad 30 minutos.
  El stock solo baja cuando el dinero entra. Si el pago no se completa, la
  unidad vuelve sola.
- **Webhook idempotente**: un reintento de Stripe no descuenta dos veces.
  Comprobado reenviando el mismo evento.
- Panel completo: figuras, prints, reseñas, pedidos con tracking, textos del
  sitio y tarifas de envío.
- Correos de confirmación y de envío, desde el dominio propio y verificados.
- SEO: datos estructurados con precio y disponibilidad, sitemap automático,
  robots.
- Seguridad: auditada sin credenciales. Pedidos, reservas, bitácora, umbrales
  de fraude y dirección de despacho devuelven 403. Sin secretos en el
  repositorio ni en el historial.

---

## 3. ANTES DE LA PRIMERA VENTA REAL

Nada de esto es código. Todo son cuentas y datos que solo puede aportar el
dueño.

### 3.1 La cuenta de Stripe — **la hace Chris**

**Una cuenta de Stripe no se transfiere.** Pertenece a quien pasó la
verificación de identidad: su nombre legal, su EIN o SSN, su banco. La cuenta
que se usó para desarrollar es del desarrollador y no puede pasar a su nombre.

1. Chris crea su cuenta en stripe.com y la activa (identidad + cuenta bancaria).
2. Agrega al desarrollador como **team member con rol Developer**. Ese rol deja
   crear el webhook sin dar acceso a los payouts.
3. Se registra el endpoint del webhook **en su cuenta**:
   ```
   https://us-east1-universo-figuras.cloudfunctions.net/stripeWebhook
   ```
   con estos cuatro eventos:
   `checkout.session.completed`, `checkout.session.expired`,
   `charge.refunded`, `charge.dispute.created`.

   > **Verificar que el endpoint aparezca en la lista antes de dar el paso por
   > hecho.** Esto ya falló una vez: el secreto se guardó pero el endpoint
   > nunca se creó, y tres pagos entraron sin que la tienda los registrara.

4. Los dos secretos, **escritos por él** para que la clave viva no pase por
   otra máquina:
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```
5. Redesplegar las funciones: `firebase deploy --only functions`

### 3.2 Impuestos — **lo único que puede costar dinero**

**Hoy la tienda cobra dinero real y NO cobra impuesto sobre las ventas.**

Estado verificado contra la API de Stripe:

| | |
|---|---|
| Stripe Tax | `active` |
| Dirección fiscal | ✅ Middletown, CT |
| **Registro de Connecticut** | ❌ **ninguno** |
| `automaticTaxEnabled` en el panel | `false` |

**El registro es lo que falta.** Stripe Tax solo cobra en las jurisdicciones
donde hay un registro cargado: con la configuración activa pero sin registros,
calcula **$0 y no se queja**. Todo se ve encendido y no cobra nada.

Los tres pasos, en orden:

1. **Connecticut emite el permiso** de Sales & Use Tax a nombre del negocio.
   Agregar el registro en Stripe **no** registra ante el estado: es al revés.
   Si le corresponde, desde cuándo, y qué fecha usar, es conversación con su
   contador.
2. **En Stripe** → *Tax → Registrations → Add registration* → United States →
   Connecticut, con la fecha desde la que aplica.
3. **En el panel → La tienda**: poner el interruptor de impuestos en `true`.

> **El paso 3 es el que se olvida.** Sin él, Chris va a creer que cobra
> impuesto —porque hizo el trámite y lo cargó en Stripe— y no va a estar
> cobrando nada. Después de activarlo, verificar que una compra de prueba
> traiga impuesto real y no cero.

Detalle que sorprende: en Connecticut **el cargo de envío también es
gravable** cuando el artículo lo es. Ya está contemplado en el código.

### 3.3 Tarifas de envío reales — **la hace Chris con el desarrollador**

**Todas las tarifas actuales son inventadas.** Sirven para que el sistema
funcione, no para cobrar.

Hay que pesar y medir una caja de cada tipo, cotizar en Pirate Ship y cargar
los números en **Panel → Envíos**:

| Tier | Para qué | Valor actual (falso) |
|---|---|---|
| Lámina | Prints en sobre rígido o tubo | $6.00 + $1.50 c/u |
| Caja mediana | Una figura normal | $12.00 + $4.00 c/u |
| Caja grande | Figuras grandes | $18.00 + $5.00 c/u |
| Pesado | Estatuas, no sale del país | $32.00 + $9.00 c/u |
| Internacional | DHL por bandas | $45 a $115 |

Cuidado con el póster de 24x36: va en tubo, cuesta más que $6 de enviar, y
como el envío gratis arranca en $50 la tienda lo absorbe siempre. Es una
decisión tomada a propósito, pero conviene verla con números reales.

### 3.4 Correos transaccionales — ✅ funcionando

Cuenta de Resend a nombre del cliente, dominio `universofiguras.com`
verificado, clave guardada en Secret Manager y funciones desplegadas.
Comprobado con un envío real: estado `delivered`.

- **Confirmación de pedido**: la manda el webhook cuando entra el pago.
- **Aviso de envío con rastreo**: lo manda un disparador de Firestore cuando
  el pedido pasa a enviado, sin importar quién lo marcó.

Salen desde `pedidos@universofiguras.com`, que **no necesita buzón** — enviar
y recibir son cosas distintas. Las respuestas van a
`lokilloshiddengems@gmail.com`, configurado en *Panel → La tienda*.

Si algún día hay que cambiar de cuenta de correo, es una clave nueva y un
redespliegue. No tiene nada del riesgo de mudar Stripe.

### 3.5 Contenido — **lo hace Chris**

En **Panel → La tienda**:
- Correo de contacto (hoy dice `REEMPLAZAR@ejemplo.com`).
- Política de envíos y política de devoluciones. Ser concreto aquí evita
  discusiones después: días para devolver, en qué estado, quién paga el
  retorno.
- Texto de *Nosotros*. Mientras esté vacío, el enlace no aparece en el sitio.

En **Panel → Figuras**:
- Fotos de los cuatro prints que están en borrador.
- El link del video de YouTube en cada figura. Un producto sin video es la
  excepción, no la norma: la ficha existe para cerrar la venta que abrió el
  video.

---

## 4. Traspaso de propiedad

A diferencia de Stripe, esto **sí se transfiere**.

| Qué | Cómo | Quién |
|---|---|---|
| Facturación de Google Cloud | Chris crea su cuenta de facturación y se vincula al proyecto; el desarrollador desvincula la suya | los dos |
| Proyecto Firebase | Agregar a Chris como **Owner**; el desarrollador se quita cuando termine | desarrollador |
| Repositorio GitHub | Transferir el repositorio a su cuenta, o agregarlo como colaborador | desarrollador |
| Dominio | Transferir en el registrador | desarrollador |
| Acceso al panel | Ya tiene: `chrisjonas1495@gmail.com` con permiso de admin | hecho |
| Resend | Se crea directo a su nombre, no hay nada que migrar | hecho al crearla |

Costo mensual esperado con poco tráfico: unos pocos dólares. Lo único que
corre las 24 horas es la instancia mínima de App Hosting cuando se active.

**Poner una alerta de presupuesto** en Cloud Billing ($10, avisos al 50% y
100%). Blaze no tiene tope duro.

---

## 5. Cómo se opera, día a día

Todo esto lo hace Chris solo, desde el panel, sin llamar a nadie.

**Cargar una figura** — *Figuras → + Nueva figura*
Título, precio, fotos, link del video, peso en libras y medidas de la caja en
pulgadas. El peso y las medidas son obligatorios aunque hoy la tarifa sea
plana: el día que se coticen tarifas reales, medir 200 cajas hacia atrás es
imposible.

**Cargar un print** — *Figuras → + Nuevo print*
Arranca ya configurado: tarifa de lámina, sin envío internacional, en la
categoría que lo manda a `/prints`.

**Aviso de caja abierta.** Por defecto toda figura sale marcada como *abierta
y reseñada*, y eso aparece en un aviso grande arriba del botón de comprar. Si
una figura está sellada, hay que elegirlo a propósito en *Condición*.

**Reponer inventario** — dentro de la figura, bloque *Inventario*.
Nunca se edita el stock a mano: los botones de agregar y quitar pasan por una
función que mantiene los números cuadrados y deja rastro.

**Despachar** — *Pedidos → el pedido → Despacho*
Se elige transportista, se pega el número de rastreo y el enlace de
seguimiento se arma solo. Solo se puede despachar lo que está pagado.

**Firma requerida**: los pedidos sobre $150 salen marcados. La firma es la
prueba que gana una disputa por "no me llegó", que es la más común del rubro.

**Cambiar tarifas** — *Envíos*. USPS sube precios en enero y julio.

**Escribir una reseña** — *Reseñas → + Nueva reseña*, enlazando las figuras de
las que habla. Eso es lo que convierte una lectura en una venta.

---

## 6. Mantenimiento

```bash
firebase deploy --only apphosting     # el sitio
```
```bash
firebase deploy --only functions      # el backend
```

**El sitio se despliega desde el código local, no desde GitHub.** Un push a
`main` no despliega nada.

Verificaciones que se corren solas:

```bash
cd functions && npm run check:shipping      # 19 checks del cotizador, sin red
```
```bash
cd functions && node scripts/smoke-cloud.js # contra lo desplegado
```

Dar permiso de admin a alguien:

```bash
cd functions && node scripts/set-admin.js correo@ejemplo.com
```

---

## 7. Trampas ya pisadas

Están documentadas para que no se repitan:

- **El asistente de App Hosting sobrescribe `apphosting.yaml`** con una
  plantilla vacía. Si el carrito deja de funcionar en producción sin error
  visible, revisar que el bloque `env` siga ahí.
- **Patrones de `.gitignore` sin barra inicial.** `lib/` se llevó `src/lib`
  entero y el repositorio quedó incompleto sin que nada avisara.
- **`outputFileTracingExcludes` en Next** aplica sus patrones también a
  `node_modules`. Rompió el panel en producción.
- **Registrar el webhook no es guardar el secreto.** Verificar que el endpoint
  exista en la lista de Stripe.

---

## 8. Pendientes que no bloquean

- `www.universofiguras.com` no responde. Se agrega como dominio adicional en
  App Hosting.
- Restringir la clave de API de Google (la que marcó GitHub). No es una fuga
  —esa clave va en el JavaScript de cualquier tienda con Firebase— pero sin
  restringir se puede usar para llamar APIs facturables del proyecto.
- Falta "olvidé mi contraseña" en el login del panel. Hoy se resetea desde la
  consola de Firebase.
- `minInstances` en `apphosting.yaml` está en 0. Subirlo a 1 antes del primer
  video evita el arranque en frío justo cuando entran 200 personas.
- El logo original es chico (474×249 px de arte real). Si aparece una versión
  grande o en vector, el logo del sitio y el icono ganan nitidez.
