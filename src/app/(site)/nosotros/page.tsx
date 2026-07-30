import { TextPage } from '@/components/TextPage';
import { getStoreContent } from '@/lib/server/store';

export const metadata = { title: 'Nosotros — Universo Figuras' };
export const dynamic = 'force-dynamic';

export default async function NosotrosPage() {
  const store = await getStoreContent();

  return (
    <TextPage
      titulo="Nosotros"
      texto={store.about}
      vacio="Estamos escribiendo esta página. Mientras tanto, todo lo que vendemos está reseñado en el canal."
    />
  );
}
