import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin para los componentes de servidor.
 *
 * En App Hosting las credenciales las pone Cloud Run automáticamente; en local
 * salen de `gcloud auth application-default login`. Leemos con Admin y no con
 * el SDK de cliente porque el servidor no debería estar sujeto a las reglas
 * cuando ya sabe lo que puede mostrar.
 */
const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  'universo-figuras';

const app = getApps().length > 0 ? getApps()[0] : initializeApp({ projectId });

export const adminDb = getFirestore(app);
