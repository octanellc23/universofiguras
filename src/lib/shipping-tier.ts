import type { ShippingTier } from './types';

/**
 * Sugiere el tipo de paquete a partir de lo que el dueño midió.
 *
 * Los cortes no son inventados: salen de cómo cobran los transportistas.
 *
 * - **Un pie cúbico (1728 in³)** es el umbral donde USPS empieza a cobrar por
 *   volumen en vez de por peso. Una caja grande y liviana cuesta como si
 *   pesara mucho más.
 * - **22 pulgadas de largo** es donde entra el recargo por paquete no
 *   estándar. Un tubo de póster lo cruza siempre.
 * - **Menos de 1.5 pulgadas de grosor** es lo que entra en un sobre rígido, el
 *   envío más barato que existe.
 *
 * Devuelve también el porqué, para mostrárselo: una sugerencia que no se
 * explica es una caja negra, y ante la duda la gente la ignora.
 */
export interface SugerenciaTier {
  tier: ShippingTier;
  razon: string;
}

export function sugerirTier(medidas: {
  weightLb: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}): SugerenciaTier | null {
  const { weightLb, lengthIn, widthIn, heightIn } = medidas;

  // Sin medidas completas no hay nada que sugerir.
  if (![weightLb, lengthIn, widthIn, heightIn].every((v) => Number.isFinite(v) && v > 0)) {
    return null;
  }

  const lados = [lengthIn, widthIn, heightIn].sort((a, b) => a - b);
  const grosor = lados[0];
  const largo = lados[2];
  const volumen = lengthIn * widthIn * heightIn;

  if (weightLb > 10) {
    return {
      tier: 'heavy',
      razon: `Pesa ${weightLb} lb. Por encima de 10 sale más barato por UPS que por USPS.`,
    };
  }

  // Dos pies cúbicos ya no es una caja: es un bulto, y ahí UPS gana.
  if (volumen > 3456) {
    return {
      tier: 'heavy',
      razon: `La caja pasa de dos pies cúbicos (${Math.round(volumen)} in³). A ese tamaño conviene UPS.`,
    };
  }

  // Pasando un pie cúbico el correo empieza a cobrar por volumen, pero sigue
  // siendo una caja grande normal, no un bulto de UPS.
  if (volumen > 1728) {
    return {
      tier: 'large',
      razon: `La caja pasa de un pie cúbico (${Math.round(volumen)} in³). A ese tamaño el correo cobra por volumen, no por peso.`,
    };
  }

  if (grosor <= 1.5 && weightLb <= 2 && largo <= 24) {
    return {
      tier: 'print',
      razon: `Solo ${grosor}" de grosor y ${weightLb} lb: entra en sobre rígido, que es el envío más barato.`,
    };
  }

  if (largo > 22) {
    return {
      tier: 'large',
      razon: `Mide ${largo}" de largo. Pasando de 22 pulgadas el correo aplica recargo por paquete no estándar.`,
    };
  }

  if (weightLb <= 3 && largo <= 14) {
    return {
      tier: 'standard',
      razon: `${weightLb} lb y ${largo}" de lado mayor: es una caja normal de figura.`,
    };
  }

  return {
    tier: 'large',
    razon: `${weightLb} lb y ${largo}" de lado mayor: no entra en la caja mediana.`,
  };
}

export const NOMBRE_TIER: Record<ShippingTier, string> = {
  print: 'Lámina en sobre rígido o tubo',
  standard: 'Caja mediana',
  large: 'Caja grande',
  heavy: 'Pesado',
};
