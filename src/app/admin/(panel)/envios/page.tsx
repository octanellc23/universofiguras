import { getShippingForm } from '@/lib/server/shipping-config';
import { ShippingFormClient } from './ShippingForm';

export const metadata = { title: 'Tarifas de envío' };
export const dynamic = 'force-dynamic';

export default async function EnviosAdminPage() {
  const inicial = await getShippingForm();
  return <ShippingFormClient inicial={inicial} />;
}
