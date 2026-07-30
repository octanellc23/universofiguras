'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { markShipped } from '@/app/admin/actions';

export function ShipForm({
  orderId,
  carrier,
  trackingNumber,
  yaEnviado,
}: {
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  yaEnviado: boolean;
}) {
  const router = useRouter();
  const [transportista, setTransportista] = useState(carrier ?? 'USPS');
  const [numero, setNumero] = useState(trackingNumber ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    setGuardando(true);
    setError(null);

    try {
      const result = await markShipped({ orderId, carrier: transportista, trackingNumber: numero });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      // Mismo caso que en el formulario de figura: si el sitio se redesplegó
      // con esta pestaña abierta, la acción de servidor ya no existe.
      setError('El sitio se actualizó. Recarga la página con F5 y vuelve a intentar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {error && <div className="notice notice--error">{error}</div>}

      <div className="field-row">
        <label className="field">
          <span className="field__label">Transportista</span>
          <select
            className="select"
            value={transportista}
            onChange={(event) => setTransportista(event.target.value)}
          >
            <option value="USPS">USPS</option>
            <option value="UPS">UPS</option>
            <option value="DHL">DHL Express</option>
          </select>
        </label>

        <label className="field">
          <span className="field__label">Número de rastreo</span>
          <input
            className="select"
            value={numero}
            onChange={(event) => setNumero(event.target.value)}
            placeholder="9400 1000 0000 0000 0000 00"
            required
          />
        </label>
      </div>

      <button type="submit" className="btn btn--primary btn--block" disabled={guardando}>
        {guardando ? 'Guardando…' : yaEnviado ? 'Actualizar el rastreo' : 'Marcar como enviado'}
      </button>
    </form>
  );
}
