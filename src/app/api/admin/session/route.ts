import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifyIdTokenIsAdmin } from '@/lib/server/auth';

/**
 * Convierte un ID token de Firebase en una cookie httpOnly, pero SOLO si el
 * token trae el claim de admin. Un usuario autenticado sin el claim recibe un
 * 403 y no se le escribe nada: la cookie no es "estás logueado", es "eres
 * admin".
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { idToken?: unknown } | null;
  const idToken = typeof body?.idToken === 'string' ? body.idToken : null;

  if (!idToken) {
    return NextResponse.json({ error: 'Falta el token.' }, { status: 400 });
  }

  if (!(await verifyIdTokenIsAdmin(idToken))) {
    return NextResponse.json({ error: 'Esta cuenta no tiene permiso.' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: idToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Los ID tokens de Firebase duran una hora; la cookie no debe sobrevivir
    // al token que contiene.
    maxAge: 60 * 60,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
