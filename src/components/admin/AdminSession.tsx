'use client';

import { onIdTokenChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { auth } from '@/lib/client/firebase';

/**
 * Mantiene viva la cookie del panel.
 *
 * Los ID tokens de Firebase caducan a la hora. El SDK los renueva solo, pero
 * la cookie httpOnly la escribe el servidor, así que cada vez que el token
 * cambia hay que volver a mandarlo. Sin esto, el dueño estaría rellenando el
 * formulario de un producto y al guardar lo echaría a la pantalla de login.
 */
export function AdminSessionSync() {
  const router = useRouter();

  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      if (!user) return;
      const idToken = await user.getIdToken();
      await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }).catch(() => undefined);
    });
  }, [router]);

  return null;
}

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="admin-nav__logout"
      onClick={async () => {
        await fetch('/api/admin/session', { method: 'DELETE' });
        await signOut(auth);
        router.replace('/admin/login');
        router.refresh();
      }}
    >
      Salir
    </button>
  );
}
