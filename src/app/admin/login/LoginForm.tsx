'use client';

import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { auth } from '@/lib/client/firebase';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();

      // El servidor decide si este token es de admin. Si no lo es, cerramos
      // la sesión del navegador: quedarse "medio logueado" solo confunde.
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        await signOut(auth);
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'No pudimos iniciar sesión.');
        setWorking(false);
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch {
      // Firebase distingue usuario inexistente de contraseña incorrecta; no lo
      // repetimos, porque eso le confirma a un curioso qué correos existen.
      setError('Correo o contraseña incorrectos.');
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel" style={{ marginTop: 0 }}>
      {error && <div className="notice notice--error">{error}</div>}

      <label className="field">
        <span className="field__label">Correo</span>
        <input
          type="email"
          className="select"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="field">
        <span className="field__label">Contraseña</span>
        <input
          type="password"
          className="select"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button type="submit" className="btn btn--primary btn--block" disabled={working}>
        {working ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
