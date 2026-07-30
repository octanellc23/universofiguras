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
