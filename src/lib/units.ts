/**
 * El dueño mide en pulgadas y pesa en libras, que es lo que marcan su cinta y
 * su balanza. La base guarda gramos y milímetros enteros —un solo sistema
 * canónico, sin decimales flotantes, igual que el dinero en centavos— y la
 * conversión vive AQUÍ, en la frontera del formulario.
 *
 * Los factores son exactos por definición, no aproximaciones.
 */
const GRAMS_PER_POUND = 453.59237;
const MM_PER_INCH = 25.4;

export function poundsToGrams(pounds: number): number {
  return Math.round(pounds * GRAMS_PER_POUND);
}

export function gramsToPounds(grams: number): number {
  // Dos decimales: 0.01 lb son ~4.5 g, más precisión de la que da una balanza
  // de cocina y más de la que pide cualquier transportista.
  return Math.round((grams / GRAMS_PER_POUND) * 100) / 100;
}

export function inchesToMm(inches: number): number {
  return Math.round(inches * MM_PER_INCH);
}

export function mmToInches(mm: number): number {
  // Un decimal: las cajas se miden al cuarto de pulgada como mucho.
  return Math.round((mm / MM_PER_INCH) * 10) / 10;
}
