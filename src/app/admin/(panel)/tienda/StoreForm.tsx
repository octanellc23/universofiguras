'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveStore, type SaveStoreInput } from '@/app/admin/actions';
import type { StoreContent } from '@/lib/server/store';

export function StoreForm({ store }: { store: StoreContent }) {
  const router = useRouter();

  const [form, setForm] = useState<SaveStoreInput>({
    storeName: store.storeName,
    supportEmail: store.supportEmail,
    youtubeChannelUrl: store.youtubeChannelUrl,
    instagram: store.social.instagram ?? '',
    facebook: store.social.facebook ?? '',
    tiktok: store.social.tiktok ?? '',
    x: store.social.x ?? '',
    about: store.about,
    returns: store.returns,
    shipping: store.shipping,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SaveStoreInput>(key: K, value: SaveStoreInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await saveStore(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('Server Action') || message.includes('Failed to fetch')
          ? 'El sitio se actualizó mientras escribías. Recarga con F5 y vuelve a guardar.'
          : 'No pudimos guardar. Revisa tu conexión y vuelve a intentar.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <div className="admin-head">
        <div>
          <h1>La tienda</h1>
          <p className="panel__hint">
            Los textos que ve el comprador. Se guardan al instante, sin desplegar nada.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--success)', fontSize: 14 }}>Guardado ✓</span>}
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {error && <div className="notice notice--error">{error}</div>}

      <div className="admin-grid">
        <div className="admin-col">
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel__title">Nosotros</h2>
            <p className="panel__hint">
              Quién eres y por qué vendes esto. Es la página que abre alguien que llegó del canal
              y quiere saber a quién le está comprando. Deja una línea en blanco entre párrafos.
            </p>
            <textarea
              className="select"
              rows={10}
              value={form.about}
              onChange={(event) => set('about', event.target.value)}
              placeholder="Llevo diez años coleccionando figuras y cinco reseñándolas en YouTube…"
            />
            <small className="field__hint">
              {form.about.trim()
                ? 'El enlace "Nosotros" ya aparece en el pie del sitio.'
                : 'Mientras esté vacío, el enlace no se muestra en el sitio.'}
            </small>
          </section>

          <section className="panel">
            <h2 className="panel__title">Política de envíos</h2>
            <p className="panel__hint">
              Cuánto tardas en despachar, con qué transportistas, y qué pasa si un paquete se
              pierde. El costo exacto ya lo calcula el carrito; esto explica el resto.
            </p>
            <textarea
              className="select"
              rows={10}
              value={form.shipping}
              onChange={(event) => set('shipping', event.target.value)}
              placeholder={
                'Despachamos en 2 días hábiles…\n\nEstados Unidos: USPS Priority Mail…\n\nLatinoamérica: DHL Express…'
              }
            />
          </section>

          <section className="panel">
            <h2 className="panel__title">Política de devoluciones</h2>
            <p className="panel__hint">
              Cuántos días tiene el comprador, en qué estado aceptas la figura de vuelta, quién
              paga el envío de retorno, y qué haces si llega dañada. Ser concreto aquí evita
              discusiones después.
            </p>
            <textarea
              className="select"
              rows={10}
              value={form.returns}
              onChange={(event) => set('returns', event.target.value)}
              placeholder={
                'Aceptamos devoluciones dentro de los 14 días…\n\nSi la figura llega dañada, mándanos una foto…'
              }
            />
          </section>
        </div>

        <div className="admin-col">
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel__title">Contacto</h2>

            <label className="field">
              <span className="field__label">Nombre de la tienda</span>
              <input
                className="select"
                value={form.storeName}
                onChange={(event) => set('storeName', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Correo de contacto</span>
              <input
                type="email"
                className="select"
                value={form.supportEmail}
                onChange={(event) => set('supportEmail', event.target.value)}
                placeholder="hola@universofiguras.com"
              />
              <small className="field__hint">
                Sale en el pie del sitio y es a donde te escriben por un pedido.
              </small>
            </label>

            <label className="field">
              <span className="field__label">Canal de YouTube</span>
              <input
                className="select"
                value={form.youtubeChannelUrl}
                onChange={(event) => set('youtubeChannelUrl', event.target.value)}
                placeholder="youtube.com/@tucanal"
              />
            </label>
          </section>

          <section className="panel">
            <h2 className="panel__title">Redes</h2>
            <p className="panel__hint">Opcionales. Se dejan vacías si no las usas.</p>

            <label className="field">
              <span className="field__label">Instagram</span>
              <input
                className="select"
                value={form.instagram}
                onChange={(event) => set('instagram', event.target.value)}
                placeholder="instagram.com/tucuenta"
              />
            </label>

            <label className="field">
              <span className="field__label">Facebook</span>
              <input
                className="select"
                value={form.facebook}
                onChange={(event) => set('facebook', event.target.value)}
                placeholder="facebook.com/tupagina"
              />
            </label>

            <label className="field">
              <span className="field__label">TikTok</span>
              <input
                className="select"
                value={form.tiktok}
                onChange={(event) => set('tiktok', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">X</span>
              <input
                className="select"
                value={form.x}
                onChange={(event) => set('x', event.target.value)}
              />
            </label>
          </section>
        </div>
      </div>
    </form>
  );
}
