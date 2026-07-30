'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(config);

export const auth = getAuth(app);

// Las fotos de producto se suben directo del navegador a Storage: pasarlas por
// una server action las metería en el límite de 1 MB del body, y una foto de
// celular pesa cuatro veces eso.
export const storage = getStorage(app);

// La región tiene que coincidir con la de las funciones o el SDK llama a
// us-central1 y recibe un 404.
const functions = getFunctions(app, process.env.NEXT_PUBLIC_FUNCTIONS_REGION ?? 'us-east1');

/**
 * Los errores de HttpsError llegan con `message` ya en español y escrito para
 * un comprador ("Solo quedan 2 de X"), así que se pueden mostrar tal cual.
 */
export async function callFunction<TRequest, TResponse>(
  name: string,
  data: TRequest
): Promise<TResponse> {
  const fn = httpsCallable<TRequest, TResponse>(functions, name);
  const result = await fn(data);
  return result.data;
}
