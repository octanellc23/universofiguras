'use client';

import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deletePost, savePost, type SavePostInput } from '@/app/admin/actions';
import { storage } from '@/lib/client/firebase';
import type { AdminPostDetail } from '@/lib/server/admin-catalog';

type Cover = NonNullable<AdminPostDetail['cover']>;

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

export function PostForm({
  post,
  productos,
}: {
  post: AdminPostDetail | null;
  productos: Array<{ id: string; title: string; status: string }>;
}) {
  const router = useRouter();
  const isNew = post === null;
  const [id] = useState(() => post?.id ?? nuevoId());

  const [form, setForm] = useState({
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    excerpt: post?.excerpt ?? '',
    body: post?.body ?? '',
    status: post?.status ?? 'draft',
    videoUrl: post?.videoId ? `https://www.youtube.com/watch?v=${post.videoId}` : '',
    tags: post?.tags ?? '',
  });

  const [productIds, setProductIds] = useState<string[]>(post?.productIds ?? []);
  const [cover, setCover] = useState<Cover | null>(post?.cover ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Dos pasos para borrar: el primer clic solo pregunta. Un botón de borrado
  // que actúa al primer toque es una reseña perdida por un dedo torpe.
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  const palabras = form.body.split(/\s+/).filter(Boolean).length;
  const minutos = Math.max(1, Math.round(palabras / 200));

  async function subirPortada(file: File) {
    setUploading(true);
    setError(null);
    try {
      let width = 0;
      let height = 0;
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch {
        /* sin medidas si el navegador no puede leerla */
      }

      const path = `posts/${id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const reference = storageRef(storage, path);
      await uploadBytes(reference, file, { contentType: file.type });
      const url = await getDownloadURL(reference);

      setCover({ url, alt: form.title || file.name, storagePath: path, width, height });
    } catch {
      setError('No pudimos subir la portada. Revisa que sea una imagen de menos de 10 MB.');
    } finally {
      setUploading(false);
    }
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: SavePostInput = {
      id,
      isNew,
      title: form.title,
      slug: form.slug || slugify(form.title),
      excerpt: form.excerpt,
      body: form.body,
      status: form.status,
      videoUrl: form.videoUrl,
      productIds,
      tags: form.tags,
      cover,
    };

    try {
      const result = await savePost(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      if (isNew) router.replace(`/admin/blog/${id}`);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('Server Action') || message.includes('Failed to fetch')
          ? 'El sitio se actualizó mientras escribías. Recarga con F5 y vuelve a guardar — la portada que subiste no se pierde.'
          : 'No pudimos guardar. Revisa tu conexión y vuelve a intentar.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function borrar() {
    setBorrando(true);
    setError(null);
    try {
      // La portada primero: si se borra el documento y falla esto, el archivo
      // queda huérfano en Storage y ya nadie sabe de dónde salió.
      if (cover) {
        await deleteObject(storageRef(storage, cover.storagePath)).catch(() => undefined);
      }
      const result = await deletePost(id);
      if (!result.ok) {
        setError(result.error);
        setBorrando(false);
        return;
      }
      router.replace('/admin/blog');
      router.refresh();
    } catch {
      setError('No pudimos borrarla. Recarga la página y vuelve a intentar.');
      setBorrando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <div className="admin-head">
        <div>
          <Link href="/admin/blog" className="admin-back">
            ← Reseñas
          </Link>
          <h1>{isNew ? 'Nueva reseña' : form.title || 'Reseña'}</h1>
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
            <label className="field">
              <span className="field__label">Título *</span>
              <input
                className="select"
                value={form.title}
                onChange={(event) => {
                  set('title', event.target.value);
                  if (isNew) set('slug', slugify(event.target.value));
                }}
                placeholder="Por qué esta Radioactive Man vale lo que cuesta"
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Dirección web</span>
              <input
                className="select"
                value={form.slug}
                onChange={(event) => set('slug', event.target.value)}
              />
              <small className="field__hint">
                universofiguras.com/blog/<b>{form.slug || 'titulo-de-la-entrada'}</b>
              </small>
            </label>

            <label className="field">
              <span className="field__label">Resumen</span>
              <textarea
                className="select"
                rows={2}
                value={form.excerpt}
                onChange={(event) => set('excerpt', event.target.value)}
                placeholder="Una o dos frases. Es lo que se ve en el listado y en Google."
              />
              <small className="field__hint">
                Si lo dejas vacío se toma el principio del texto.
              </small>
            </label>

            <label className="field">
              <span className="field__label">La reseña *</span>
              <textarea
                className="select"
                rows={18}
                value={form.body}
                onChange={(event) => set('body', event.target.value)}
                placeholder="Escribe como hablas en el video. Deja una línea en blanco entre párrafos."
                required
              />
              <small className="field__hint">
                {palabras} palabras · {minutos} min de lectura
              </small>
            </label>
          </section>
        </div>

        <div className="admin-col">
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel__title">Publicación</h2>

            <label className="field">
              <span className="field__label">Estado</span>
              <select
                className="select"
                value={form.status}
                onChange={(event) => set('status', event.target.value)}
              >
                <option value="draft">Borrador (no se ve en el sitio)</option>
                <option value="published">Publicada</option>
                <option value="archived">Archivada</option>
              </select>
            </label>

            <label className="field">
              <span className="field__label">Etiquetas</span>
              <input
                className="select"
                value={form.tags}
                onChange={(event) => set('tags', event.target.value)}
                placeholder="simpsons, jakks, reseña"
              />
            </label>

            {!isNew && (
              <>
                <div className="divider" />
                {confirmando ? (
                  <div className="notice notice--error" style={{ marginBottom: 0 }}>
                    <p style={{ marginBottom: 12 }}>
                      Se borra para siempre, junto con su portada. Si solo quieres sacarla del
                      sitio, cámbiala a <strong>Borrador</strong> arriba.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={borrando}
                        onClick={borrar}
                      >
                        {borrando ? 'Borrando…' : 'Sí, borrarla'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setConfirmando(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setConfirmando(true)}
                  >
                    Borrar esta reseña
                  </button>
                )}
              </>
            )}
          </section>

          <section className="panel">
            <h2 className="panel__title">Portada</h2>
            <div className="thumbs">
              {cover && (
                <div className="thumb">
                  <img src={cover.url} alt={cover.alt} />
                  <button
                    type="button"
                    title="Quitar"
                    onClick={async () => {
                      const anterior = cover;
                      setCover(null);
                      await deleteObject(storageRef(storage, anterior.storagePath)).catch(
                        () => undefined
                      );
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {!cover && (
                <label className="thumb thumb--add">
                  {uploading ? 'Subiendo…' : '+ Portada'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    hidden
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void subirPortada(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">El video</h2>
            <label className="field">
              <span className="field__label">Link de YouTube</span>
              <input
                className="select"
                value={form.videoUrl}
                onChange={(event) => set('videoUrl', event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>
          </section>

          <section className="panel">
            <h2 className="panel__title">Figuras de las que habla</h2>
            <p className="panel__hint">
              Aparecen al final de la reseña con su precio y su botón. Es lo que convierte una
              lectura en una venta.
            </p>

            {productos.length === 0 ? (
              <p className="panel__hint">Todavía no hay figuras cargadas.</p>
            ) : (
              <div style={{ display: 'grid', gap: 4 }}>
                {productos.map((producto) => (
                  <label key={producto.id} className="check">
                    <input
                      type="checkbox"
                      checked={productIds.includes(producto.id)}
                      onChange={(event) =>
                        setProductIds((current) =>
                          event.target.checked
                            ? [...current, producto.id]
                            : current.filter((item) => item !== producto.id)
                        )
                      }
                    />
                    {producto.title}
                    {producto.status !== 'active' && (
                      <small className="field__hint">(sin publicar)</small>
                    )}
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </form>
  );
}
