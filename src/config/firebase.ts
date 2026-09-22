import admin from 'firebase-admin';
import config from '.';

if (!admin.apps.length) {
  if (config.FIREBASE_PROJECT_ID && config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey: config.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } catch (err) {
      console.error('[Firebase] Failed to initialize Firebase Admin SDK:', err);
    }
  } else {
    console.warn('[Firebase] Firebase Admin credentials not provided in environment variables. Push notifications will be disabled.');
  }
}

export const firebaseAdmin = admin;

