/**
 * Todo el dinero del sistema son centavos enteros (I2). Esta es la ÚNICA
 * frontera donde se convierte a algo legible; nunca al revés.
 */
const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}

/**
 * "12.00" → 1200. Devuelve null si no es un número válido, para que quien
 * llama decida el mensaje de error.
 *
 * El redondeo es obligatorio, no cosmético: 12.00 * 100 en punto flotante da
 * 1199.9999999999998.
 */
export function dollarsToCents(value: string): number | null {
  const clean = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
  const amount = Number.parseFloat(clean);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

/** 1200 → "12.00", para pintar un campo de formulario. */
export function centsToDollars(cents: number): string {
  return ((cents ?? 0) / 100).toFixed(2);
}
