import { adminDb } from './admin';

export interface StoreContent {
  storeName: string;
  supportEmail: string;
  youtubeChannelUrl: string;
  social: { instagram: string | null; tiktok: string | null; x: string | null };
  about: string;
  returns: string;
  shipping: string;
}

/**
 * Los textos del sitio viven en Firestore, no en el código, por la misma razón
 * que las tarifas: el dueño los cambia desde el panel y no hace falta
 * desplegar nada.
 */
export async function getStoreContent(): Promise<StoreContent> {
  const snap = await adminDb.collection('config').doc('store').get();
  const data = snap.data() ?? {};

  const limpio = (valor: unknown): string => {
    const texto = typeof valor === 'string' ? valor.trim() : '';
    // "REEMPLAZAR" es el marcador del seed; mostrarlo sería peor que no
    // mostrar nada.
    return texto === 'REEMPLAZAR' || texto.startsWith('REEMPLAZAR@') ? '' : texto;
  };

  return {
    storeName: limpio(data.storeName) || 'Universo Figuras',
    supportEmail: limpio(data.supportEmail),
    youtubeChannelUrl: limpio(data.youtubeChannelUrl),
    social: {
      instagram: limpio(data.social?.instagram) || null,
      tiktok: limpio(data.social?.tiktok) || null,
      x: limpio(data.social?.x) || null,
    },
    about: limpio(data.about),
    returns: limpio(data.policies?.returnsMarkdown),
    shipping: limpio(data.policies?.shippingMarkdown),
  };
}
