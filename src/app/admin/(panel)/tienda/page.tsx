import { getStoreContent } from '@/lib/server/store';
import { StoreForm } from './StoreForm';

export const metadata = { title: 'La tienda' };
export const dynamic = 'force-dynamic';

export default async function TiendaPage() {
  const store = await getStoreContent();
  return <StoreForm store={store} />;
}
