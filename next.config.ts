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
  // functions/ tiene su propio package.json y su propio tsconfig; no es parte
  // del build del sitio.
  outputFileTracingExcludes: {
    '*': ['./functions/**/*'],
  },
};

export default config;
