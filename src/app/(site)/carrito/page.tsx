import { CartClient } from './CartClient';
import { getShippingCountries } from '@/lib/server/catalog';

export const metadata = { title: 'Tu carrito — Universo Figuras' };
export const dynamic = 'force-dynamic';

export default async function CartPage() {
  // La lista de países sale de config/shipping: si el dueño agrega una banda,
  // aparece aquí sin tocar código.
  const countries = await getShippingCountries();

  return (
    <div className="shell">
      <div className="breadcrumb">Tu carrito</div>
      <CartClient countries={countries} />
    </div>
  );
}
