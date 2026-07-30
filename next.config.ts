import type { NextConfig } from 'next';

const config: NextConfig = {
  // Las fotos de producto viven en Cloud Storage. Sin esto, next/image las
  // rechaza por venir de otro dominio.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  // NO añadir outputFileTracingExcludes con patrones como './functions/**/*':
  // Next aplica esos globs contra TODOS los archivos rastreados, incluidos los
  // de node_modules, y excluye cualquier dependencia que tenga una carpeta con
  // ese nombre. Rompió el sitio en producción con "Cannot find module
  // './functions/parse'" mientras en local todo compilaba.
  //
  // La carpeta functions/ del repositorio no necesita exclusión: nadie la
  // importa desde la app, así que el rastreo no la toca.
};

export default config;
