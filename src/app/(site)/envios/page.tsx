import { TextPage } from '@/components/TextPage';
import { getStoreContent } from '@/lib/server/store';

export const metadata = { title: 'Envíos — Universo Figuras' };
export const dynamic = 'force-dynamic';

export default async function EnviosPage() {
  const store = await getStoreContent();

  return (
    <TextPage
      titulo="Envíos"
      texto={store.shipping}
      vacio="Todavía no publicamos esta política. El costo exacto de tu envío se calcula en el carrito, antes de pagar."
    />
  );
}
