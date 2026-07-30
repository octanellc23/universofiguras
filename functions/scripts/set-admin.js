/**
 * Otorga (o quita) el custom claim `admin: true` a un usuario.
 *
 *   node scripts/set-admin.js correo@ejemplo.com
 *   node scripts/set-admin.js correo@ejemplo.com --quitar
 *
 * El claim es lo único que abre /admin y lo único que las reglas de Firestore
 * y Storage aceptan como "este sí puede". No hay lista de administradores en
 * ninguna colección: la verdad vive en el token.
 *
 * El usuario tiene que existir antes en Firebase Auth (Consola → Authentication
 * → Add user). Después de correr esto, tiene que volver a iniciar sesión: los
 * claims viajan dentro del token y el que ya tenga en el navegador es viejo.
 */
const admin = require('firebase-admin');

const email = process.argv[2];
const quitar = process.argv.includes('--quitar');

if (!email) {
  console.error('Falta el correo.\n  node scripts/set-admin.js correo@ejemplo.com');
  process.exit(1);
}

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'universo-figuras' });

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, quitar ? {} : { admin: true });

  const fresh = await admin.auth().getUser(user.uid);
  console.log(`${email} (${user.uid})`);
  console.log('claims:', JSON.stringify(fresh.customClaims ?? {}));
  console.log(
    quitar
      ? '\nPermiso retirado.'
      : '\nListo. Tiene que cerrar sesión y volver a entrar para que el token traiga el claim.'
  );
})().catch((error) => {
  if (error.code === 'auth/user-not-found') {
    console.error(
      `No existe ningún usuario con ${email}.\n` +
        'Créalo primero en la consola: Authentication → Users → Add user.'
    );
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
