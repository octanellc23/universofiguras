'use client';

import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveProduct, type SaveProductInput } from '@/app/admin/actions';
import { callFunction } from '@/lib/client/firebase';
import { storage } from '@/lib/client/firebase';
import type { AdminProductDetail } from '@/lib/server/admin-catalog';

type Image = AdminProductDetail['images'][number];

function nuevoId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ProductForm({ product }: { product: AdminProductDetail | null }) {
  const router = useRouter();
  const isNew = product === null;
  const [id] = useState(() => product?.id ?? nuevoId());

  const [form, setForm] = useState({
    title: product?.title ?? '',
    slug: product?.slug ?? '',
    subtitle: product?.subtitle ?? '',
    description: product?.description ?? '',
    manufacturer: product?.manufacturer ?? '',
    line: product?.line ?? '',
    scale: product?.scale ?? '',
    // Lo normal aquí es abierta y reseñada, así que ese es el valor por
    // defecto. Sellada es la excepción y hay que elegirla a propósito.
    condition: product?.condition ?? 'openbox',
    price: product?.price ?? '',
    status: product?.status ?? 'draft',
    featured: product?.featured ?? false,
    stock: product?.stock ?? 1,
    tier: product?.tier ?? 'standard',
    weightLb: product?.weightLb ? String(product.weightLb) : '',
    length: product?.dimsIn.length ? String(product.dimsIn.length) : '',
    width: product?.dimsIn.width ? String(product.dimsIn.width) : '',
    height: product?.dimsIn.height ? String(product.dimsIn.height) : '',
    freeShippingEligible: product?.freeShippingEligible ?? true,
    localPickupEligible: product?.localPickupEligible ?? true,
    internationalEligible: product?.internationalEligible ?? true,
    handlingDays: product?.handlingDays ?? 2,
    consolidateHold: product?.consolidateHold ?? false,
    videoUrl: product?.videoId ? `https://www.youtube.com/watch?v=${product.videoId}` : '',
    videoTitle: product?.videoTitle ?? '',
    videoStart: product?.videoStartSeconds ? String(product.videoStartSeconds) : '',
    categories: product?.categories ?? '',
    tags: product?.tags ?? '',
  });

  const [images, setImages] = useState<Image[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function subirFotos(files: FileList) {
    setUploading(true);
    setError(null);

    try {
      const subidas: Image[] = [];
      for (const file of Array.from(files)) {
        // Las medidas se leen del archivo: sirven para que el navegador
        // reserve el espacio y la página no salte al cargar la foto.
        let width = 0;
        let height = 0;
        try {
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close();
        } catch {
          /* si el navegador no puede leerla, seguimos sin medidas */
        }

        const path = `products/${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const reference = storageRef(storage, path);
        await uploadBytes(reference, file, { contentType: file.type });
        const url = await getDownloadURL(reference);

        subidas.push({ url, alt: form.title || file.name, storagePath: path, width, height });
      }
      setImages((current) => [...current, ...subidas]);
    } catch {
      setError('No pudimos subir alguna foto. Revisa que sea una imagen de menos de 10 MB.');
    } finally {
      setUploading(false);
    }
  }

  async function quitarFoto(image: Image) {
    setImages((current) => current.filter((item) => item.storagePath !== image.storagePath));
    // Si falla el borrado en Storage no pasa nada grave: el archivo queda
    // huérfano pero la ficha ya no lo muestra.
    await deleteObject(storageRef(storage, image.storagePath)).catch(() => undefined);
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: SaveProductInput = {
      id,
      isNew,
      title: form.title,
      slug: form.slug || slugify(form.title),
      subtitle: form.subtitle,
      description: form.description,
      manufacturer: form.manufacturer,
      line: form.line,
      scale: form.scale,
      condition: form.condition,
      price: form.price,
      status: form.status,
      featured: form.featured,
      stock: Number(form.stock),
      tier: form.tier,
      weightLb: Number(form.weightLb),
      dimsIn: {
        length: Number(form.length),
        width: Number(form.width),
        height: Number(form.height),
      },
      freeShippingEligible: form.freeShippingEligible,
      localPickupEligible: form.localPickupEligible,
      internationalEligible: form.internationalEligible,
      handlingDays: Number(form.handlingDays),
      consolidateHold: form.consolidateHold,
      videoUrl: form.videoUrl,
      videoTitle: form.videoTitle,
      videoStart: form.videoStart,
      categories: form.categories,
      tags: form.tags,
      images,
    };

    try {
      const result = await saveProduct(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
      if (isNew) router.replace(`/admin/productos/${id}`);
      router.refresh();
    } catch (err: unknown) {
      // Next identifica cada server action con un hash del build. Si el sitio
      // se redesplegó mientras esta pestaña estaba abierta, el identificador
      // que manda el navegador ya no existe y la llamada falla. Sin este
      // catch, el botón se quedaba en "Guardando…" para siempre.
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('Server Action') || message.includes('Failed to fetch')
          ? 'El sitio se actualizó mientras llenabas el formulario. Recarga la página con F5 y vuelve a guardar — las fotos que subiste no se pierden.'
          : 'No pudimos guardar. Revisa tu conexión y vuelve a intentar.'
      );
    } finally {
      // Pase lo que pase, el botón vuelve a responder.
      setSaving(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <div className="admin-head">
        <div>
          <Link href="/admin/productos" className="admin-back">
            ← Figuras
          </Link>
          <h1>{isNew ? 'Nueva figura' : form.title || 'Figura'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--success)', fontSize: 14 }}>Guardado ✓</span>}
          <button type="submit" className="btn btn--primary" disabled={saving || uploading}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {error && <div className="notice notice--error">{error}</div>}

      <div className="admin-grid">
        <div className="admin-col">
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel__title">Lo básico</h2>

            <label className="field">
              <span className="field__label">Título *</span>
              <input
                className="select"
                value={form.title}
                onChange={(event) => {
                  set('title', event.target.value);
                  // La dirección web se genera sola mientras nadie la toque a
                  // mano: el dueño no tiene por qué saber qué es un slug.
                  if (isNew) set('slug', slugify(event.target.value));
                }}
                placeholder="Batman Arkham Knight — McFarlane 7 pulgadas"
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Dirección web</span>
              <input
                className="select"
                value={form.slug}
                onChange={(event) => set('slug', event.target.value)}
                placeholder="batman-arkham-knight"
              />
              <small className="field__hint">
                universofiguras.com/producto/<b>{form.slug || 'batman-arkham-knight'}</b>
              </small>
            </label>

            <label className="field">
              <span className="field__label">Descripción</span>
              <textarea
                className="select"
                rows={6}
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="Qué trae la caja, en qué estado está, por qué vale la pena."
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Precio (USD) *</span>
                <input
                  className="select"
                  value={form.price}
                  onChange={(event) => set('price', event.target.value)}
                  placeholder="49.99"
                  inputMode="decimal"
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Estado</span>
                <select
                  className="select"
                  value={form.status}
                  onChange={(event) => set('status', event.target.value)}
                >
                  <option value="draft">Borrador (no se ve en la tienda)</option>
                  <option value="active">Publicada</option>
                  <option value="archived">Archivada</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">Fotos</h2>
            <p className="panel__hint">La primera es la que se ve en el catálogo.</p>

            <div className="thumbs">
              {images.map((image) => (
                <div key={image.storagePath} className="thumb">
                  <img src={image.url} alt={image.alt} />
                  <button type="button" onClick={() => quitarFoto(image)} title="Quitar">
                    ×
                  </button>
                </div>
              ))}
              <label className="thumb thumb--add">
                {uploading ? 'Subiendo…' : '+ Agregar'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  hidden
                  disabled={uploading}
                  onChange={(event) => {
                    if (event.target.files?.length) void subirFotos(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">El video</h2>
            <p className="panel__hint">
              La reseña de donde viene la venta. Pega el link tal cual de YouTube.
            </p>

            <label className="field">
              <span className="field__label">Link del video</span>
              <input
                className="select"
                value={form.videoUrl}
                onChange={(event) => set('videoUrl', event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span className="field__label">Título del video</span>
                <input
                  className="select"
                  value={form.videoTitle}
                  onChange={(event) => set('videoTitle', event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label className="field">
                <span className="field__label">Empieza en</span>
                <input
                  className="select"
                  value={form.videoStart}
                  onChange={(event) => set('videoStart', event.target.value)}
                  placeholder="4:20"
                />
                <small className="field__hint">Minuto donde aparece esta figura.</small>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">Detalles</h2>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Fabricante</span>
                <input
                  className="select"
                  value={form.manufacturer}
                  onChange={(event) => set('manufacturer', event.target.value)}
                  placeholder="McFarlane Toys"
                />
              </label>
              <label className="field">
                <span className="field__label">Línea</span>
                <input
                  className="select"
                  value={form.line}
                  onChange={(event) => set('line', event.target.value)}
                  placeholder="DC Multiverse"
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Escala</span>
                <input
                  className="select"
                  value={form.scale}
                  onChange={(event) => set('scale', event.target.value)}
                  placeholder="7 pulgadas"
                />
              </label>
              <label className="field">
                <span className="field__label">Condición</span>
                <select
                  className="select"
                  value={form.condition}
                  onChange={(event) => set('condition', event.target.value)}
                >
                  <option value="openbox">Abierta y reseñada (lo normal)</option>
                  <option value="new">Sellada, sin abrir</option>
                  <option value="used">Usada</option>
                </select>
                <small className="field__hint">
                  Sale como aviso grande en la ficha, arriba del botón de comprar.
                </small>
              </label>
            </div>
            <label className="field">
              <span className="field__label">Etiquetas</span>
              <input
                className="select"
                value={form.tags}
                onChange={(event) => set('tags', event.target.value)}
                placeholder="batman, dc, mcfarlane"
              />
              <small className="field__hint">Separadas por comas.</small>
            </label>
          </section>
        </div>

        <div className="admin-col">
          {!isNew && product && <Inventario product={product} />}

          <section className="panel" style={{ marginTop: isNew ? 0 : undefined }}>
            <h2 className="panel__title">Caja y envío</h2>
            <p className="panel__hint">
              El peso y las medidas son obligatorios aunque hoy la tarifa sea plana. El día que
              cotizemos con tarifas reales, medir las cajas hacia atrás es imposible.
            </p>

            {isNew && (
              <label className="field">
                <span className="field__label">Unidades que tienes *</span>
                <input
                  type="number"
                  min={0}
                  className="select"
                  value={form.stock}
                  onChange={(event) => set('stock', Number(event.target.value))}
                />
              </label>
            )}

            <label className="field">
              <span className="field__label">Tamaño del paquete *</span>
              <select
                className="select"
                value={form.tier}
                onChange={(event) => set('tier', event.target.value)}
              >
                <option value="print">Lámina en sobre rígido o tubo</option>
                <option value="standard">Caja mediana — lo normal para figuras</option>
                <option value="large">Caja grande</option>
                <option value="heavy">Pesado, no entra en caja plana (solo EE. UU.)</option>
              </select>
              <small className="field__hint">
                En un carrito mezclado se cobra el envío del paquete más grande, no la suma.
              </small>
            </label>

            <label className="field">
              <span className="field__label">Peso en libras *</span>
              <input
                type="number"
                min={0.01}
                step={0.1}
                className="select"
                value={form.weightLb}
                onChange={(event) => set('weightLb', event.target.value)}
                placeholder="2.5"
                required
              />
              <small className="field__hint">
                Con la caja y el relleno, tal como sale al correo.
              </small>
            </label>

            <span className="field__label">Medidas de la caja en pulgadas *</span>
            <div className="field-row field-row--three">
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="select"
                value={form.length}
                onChange={(event) => set('length', event.target.value)}
                placeholder="Largo"
                required
              />
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="select"
                value={form.width}
                onChange={(event) => set('width', event.target.value)}
                placeholder="Ancho"
                required
              />
              <input
                type="number"
                min={0.1}
                step={0.5}
                className="select"
                value={form.height}
                onChange={(event) => set('height', event.target.value)}
                placeholder="Alto"
                required
              />
            </div>

            <div className="divider" />

            <label className="check">
              <input
                type="checkbox"
                checked={form.freeShippingEligible}
                onChange={(event) => set('freeShippingEligible', event.target.checked)}
              />
              Cuenta para el envío gratis
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.localPickupEligible}
                onChange={(event) => set('localPickupEligible', event.target.checked)}
              />
              Se puede recoger en persona
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.tier !== 'heavy' && form.internationalEligible}
                disabled={form.tier === 'heavy'}
                onChange={(event) => set('internationalEligible', event.target.checked)}
              />
              Se puede enviar fuera de EE. UU.
              {form.tier === 'heavy' && (
                <small className="field__hint">Lo pesado no sale del país.</small>
              )}
              {form.tier === 'print' && form.internationalEligible && (
                <small className="field__hint" style={{ color: 'var(--warning)' }}>
                  Ojo: mandar una lámina por DHL cuesta más que la lámina.
                </small>
              )}
            </label>

            <div className="divider" />

            <label className="field">
              <span className="field__label">Días hábiles para despachar</span>
              <input
                type="number"
                min={0}
                className="select"
                value={form.handlingDays}
                onChange={(event) => set('handlingDays', Number(event.target.value))}
              />
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={form.consolidateHold}
                onChange={(event) => set('consolidateHold', event.target.checked)}
              />
              Esperar para mandar junto con otros pedidos
            </label>
          </section>
        </div>
      </div>
    </form>
  );
}

/**
 * El inventario NO se edita en este formulario: `stock`, `reserved` y
 * `available` son campos derivados que se mueven en transacción. Reponer pasa
 * por la callable adjustStockLevel, que es el mismo camino que usa el resto
 * del sistema.
 */
function Inventario({ product }: { product: AdminProductDetail }) {
  const router = useRouter();
  const [delta, setDelta] = useState(1);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ajustar(cantidad: number) {
    setWorking(true);
    setError(null);
    try {
      await callFunction<{ productId: string; delta: number; note: string }, unknown>(
        'adjustStockLevel',
        { productId: product.id, delta: cantidad, note: 'Ajuste desde el panel' }
      );
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No pudimos ajustar el inventario.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: 0 }}>
      <h2 className="panel__title">Inventario</h2>

      {error && <div className="notice notice--error">{error}</div>}

      <div className="stock-grid">
        <div>
          <span className="stock-grid__num">{product.stock}</span>
          <span className="stock-grid__label">en tus manos</span>
        </div>
        <div>
          <span className="stock-grid__num">{product.reserved}</span>
          <span className="stock-grid__label">apartadas</span>
        </div>
        <div>
          <span className="stock-grid__num">{product.available}</span>
          <span className="stock-grid__label">a la venta</span>
        </div>
      </div>

      {product.reserved > 0 && (
        <p className="panel__hint">
          Hay {product.reserved} unidad(es) en compras a medio hacer. Se liberan solas si nadie
          termina de pagar.
        </p>
      )}

      <div className="field-row" style={{ marginTop: 14 }}>
        <input
          type="number"
          className="select"
          value={delta}
          min={1}
          onChange={(event) => setDelta(Math.max(1, Number(event.target.value)))}
        />
        <button
          type="button"
          className="btn btn--ghost"
          disabled={working}
          onClick={() => ajustar(delta)}
        >
          + Agregar
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={working}
          onClick={() => ajustar(-delta)}
        >
          − Quitar
        </button>
      </div>
    </section>
  );
}
