import { TextPage } from '@/components/TextPage';
import { getStoreContent } from '@/lib/server/store';

export const metadata = {
  title: 'Devoluciones',
  description: 'Qué hacer si tu figura llega dañada o quieres devolverla.',
  alternates: { canonical: '/devoluciones' },
};
export const dynamic = 'force-dynamic';

export default async function DevolucionesPage() {
  const store = await getStoreContent();

  return (
    <TextPage
      titulo="Devoluciones"
      texto={store.returns}
      vacio={
        store.supportEmail
          ? `Todavía no publicamos esta política. Si tienes un problema con tu pedido, escríbenos a ${store.supportEmail} y lo resolvemos.`
          : 'Todavía no publicamos esta política. Si tienes un problema con tu pedido, escríbenos y lo resolvemos.'
      }
    />
  );
}
