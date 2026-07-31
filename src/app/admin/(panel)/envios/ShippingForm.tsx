'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveShipping, type SaveShippingInput } from '@/app/admin/actions';
import type { RateForm, ShippingForm } from '@/lib/server/shipping-config';

function Tarifa({
  titulo,
  ayuda,
  valor,
  onChange,
}: {
  titulo: string;
  ayuda: string;
  valor: RateForm;
  onChange: (v: RateForm) => void;
}) {
  return (
    <section className="panel">
      <h2 className="panel__title">{titulo}</h2>
      <p className="panel__hint">{ayuda}</p>

      <label className="field">
        <span className="field__label">Cómo se ve en el carrito</span>
        <input
          className="select"
          value={valor.label}
          onChange={(e) => onChange({ ...valor, label: e.target.value })}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field__label">Primera figura</span>
          <input
            className="select"
            value={valor.base}
            inputMode="decimal"
            onChange={(e) => onChange({ ...valor, base: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">Cada figura extra</span>
          <input
            className="select"
            value={valor.additional}
            inputMode="decimal"
            onChange={(e) => onChange({ ...valor, additional: e.target.value })}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">Días mínimo</span>
          <input
            type="number"
            min={0}
            className="select"
            value={valor.daysMin}
            onChange={(e) => onChange({ ...valor, daysMin: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span className="field__label">Días máximo</span>
          <input
            type="number"
            min={0}
            className="select"
            value={valor.daysMax}
            onChange={(e) => onChange({ ...valor, daysMax: Number(e.target.value) })}
          />
        </label>
      </div>
    </section>
  );
}

export function ShippingFormClient({ inicial }: { inicial: ShippingForm }) {
  const router = useRouter();
  const [form, setForm] = useState(inicial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ShippingForm>(key: K, value: ShippingForm[K]) {
    setForm((c) => ({ ...c, [key]: value }));
    setSaved(false);
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: SaveShippingInput = {
      print: form.print,
      standard: form.standard,
      large: form.large,
      heavy: form.heavy,
      freeEnabled: form.freeEnabled,
      freeThreshold: form.freeThreshold,
      internationalEnabled: form.internationalEnabled,
      bands: form.bands,
      pickupEnabled: form.pickupEnabled,
      pickupFee: form.pickupFee,
      pickupLabel: form.pickupLabel,
      pickupInstructions: form.pickupInstructions,
    };

    try {
      const result = await saveShipping(input);
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
          ? 'El sitio se actualizó mientras editabas. Recarga con F5 y vuelve a guardar.'
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
          <h1>Tarifas de envío</h1>
          <p className="panel__hint">
            Todo en dólares. Los cambios aplican al instante, sin desplegar nada — que es
            justamente para lo que existe esta pantalla cuando USPS sube precios.
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

      <div className="notice notice--info">
        Un carrito con varias figuras <strong>no suma los envíos</strong>. Se cobra la tarifa del
        paquete más grande del carrito, más el importe de &quot;cada figura extra&quot; por cada
        unidad adicional. Nadie paga tres envíos por tres figuras.
      </div>

      <div className="admin-grid">
        <div className="admin-col">
          <Tarifa
            titulo="Lámina"
            ayuda="Prints en sobre rígido o tubo. Van por USPS Ground Advantage como paquete liviano: una caja Flat Rate costaría el doble por algo que pesa 200 gramos."
            valor={form.print}
            onChange={(v) => set('print', v)}
          />
          <Tarifa
            titulo="Caja mediana"
            ayuda="Lo normal: una figura de 7 pulgadas en su caja. USPS Priority Mail Flat Rate Medium."
            valor={form.standard}
            onChange={(v) => set('standard', v)}
          />
          <Tarifa
            titulo="Caja grande"
            ayuda="Figuras grandes o cajas voluminosas. USPS Priority Mail Flat Rate Large."
            valor={form.large}
            onChange={(v) => set('large', v)}
          />
          <Tarifa
            titulo="Pesado"
            ayuda="Estatuas y dioramas que no entran en caja plana. UPS Ground, cotizado a la zona más cara. Estos artículos no salen de Estados Unidos."
            valor={form.heavy}
            onChange={(v) => set('heavy', v)}
          />
        </div>

        <div className="admin-col">
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel__title">Envío gratis</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={form.freeEnabled}
                onChange={(e) => set('freeEnabled', e.target.checked)}
              />
              Regalar el envío sobre cierto monto
            </label>
            <label className="field" style={{ marginTop: 12 }}>
              <span className="field__label">A partir de</span>
              <input
                className="select"
                value={form.freeThreshold}
                inputMode="decimal"
                disabled={!form.freeEnabled}
                onChange={(e) => set('freeThreshold', e.target.value)}
              />
              <small className="field__hint">
                Se mide sobre el precio de las figuras, sin contar el envío. Solo aplica dentro de
                Estados Unidos: regalar un envío de DHL se come el margen completo.
              </small>
            </label>
          </section>

          <section className="panel">
            <h2 className="panel__title">Recogido en persona</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={form.pickupEnabled}
                onChange={(e) => set('pickupEnabled', e.target.checked)}
              />
              Ofrecerlo como opción
            </label>
            <label className="field" style={{ marginTop: 12 }}>
              <span className="field__label">Costo</span>
              <input
                className="select"
                value={form.pickupFee}
                inputMode="decimal"
                disabled={!form.pickupEnabled}
                onChange={(e) => set('pickupFee', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Cómo se ve en el carrito</span>
              <input
                className="select"
                value={form.pickupLabel}
                disabled={!form.pickupEnabled}
                onChange={(e) => set('pickupLabel', e.target.value)}
              />
              <small className="field__hint">
                No pongas la ciudad ni la dirección: esto lo ve cualquiera.
              </small>
            </label>
            <label className="field">
              <span className="field__label">Qué le dices al comprador</span>
              <textarea
                className="select"
                rows={3}
                value={form.pickupInstructions}
                disabled={!form.pickupEnabled}
                onChange={(e) => set('pickupInstructions', e.target.value)}
              />
            </label>
          </section>

          <section className="panel">
            <h2 className="panel__title">Internacional</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={form.internationalEnabled}
                onChange={(e) => set('internationalEnabled', e.target.checked)}
              />
              Vender fuera de Estados Unidos
            </label>
            <p className="panel__hint" style={{ marginTop: 10 }}>
              Solo DHL Express. Los países de cada grupo no se editan aquí: cambiarlos decide a
              dónde se puede vender, que es otra conversación.
            </p>
          </section>
        </div>
      </div>

      {form.internationalEnabled && (
        <div className="admin-grid" style={{ marginTop: 20 }}>
          {form.bands.map((banda, index) => (
            <section key={banda.id} className="panel" style={{ marginTop: 0 }}>
              <h2 className="panel__title">{banda.label}</h2>
              <p className="panel__hint">{banda.countries}</p>

              <div className="field-row">
                <label className="field">
                  <span className="field__label">Mediana, primera</span>
                  <input
                    className="select"
                    value={banda.standardBase}
                    inputMode="decimal"
                    onChange={(e) => {
                      const bands = [...form.bands];
                      bands[index] = { ...banda, standardBase: e.target.value };
                      set('bands', bands);
                    }}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Mediana, extra</span>
                  <input
                    className="select"
                    value={banda.standardAdditional}
                    inputMode="decimal"
                    onChange={(e) => {
                      const bands = [...form.bands];
                      bands[index] = { ...banda, standardAdditional: e.target.value };
                      set('bands', bands);
                    }}
                  />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span className="field__label">Grande, primera</span>
                  <input
                    className="select"
                    value={banda.largeBase}
                    inputMode="decimal"
                    onChange={(e) => {
                      const bands = [...form.bands];
                      bands[index] = { ...banda, largeBase: e.target.value };
                      set('bands', bands);
                    }}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Grande, extra</span>
                  <input
                    className="select"
                    value={banda.largeAdditional}
                    inputMode="decimal"
                    onChange={(e) => {
                      const bands = [...form.bands];
                      bands[index] = { ...banda, largeAdditional: e.target.value };
                      set('bands', bands);
                    }}
                  />
                </label>
              </div>
            </section>
          ))}
        </div>
      )}
    </form>
  );
}
