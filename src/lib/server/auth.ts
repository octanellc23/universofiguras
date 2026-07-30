import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  'universo-figuras';

const app = getApps().length > 0 ? getApps()[0] : initializeApp({ projectId });
const auth = getAuth(app);

export const ADMIN_COOKIE = 'uf_admin_token';

export interface AdminSession {
  uid: string;
  email: string | null;
}

/**
 * Guardamos el ID token en una cookie httpOnly y lo verificamos con la clave
 * pública de Google. NO usamos createSessionCookie a propósito: esa API firma
 * con la cuenta de servicio y necesita permiso de firma, que no está
 * garantizado ni en local (credenciales de usuario) ni en Cloud Run sin
 * configurarlo. Verificar un ID token no firma nada.
 *
 * El costo es que el token dura una hora; el cliente lo renueva solo y vuelve
 * a escribir la cookie (ver AdminSessionSync).
 */
export async function readAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    // El claim es la única fuente de verdad. Un usuario autenticado sin él es
    // un visitante cualquiera.
    if (decoded.admin !== true) return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    // Token vencido o inválido: se trata como no autenticado, sin ruido.
    return null;
  }
}

/** Para páginas y server actions: corta la ejecución si no hay admin. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await readAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

export async function verifyIdTokenIsAdmin(idToken: string): Promise<boolean> {
  try {
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.admin === true;
  } catch {
    return false;
  }
}
