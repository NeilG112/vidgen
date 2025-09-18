import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

let _adminApp: App | undefined;
let _adminDb: Firestore | undefined;
let _adminStorage: Storage | undefined;

function hasAdminEnv() {
  return !!(
  process.env['FIREBASE_CLIENT_EMAIL'] &&
  process.env['FIREBASE_PRIVATE_KEY'] &&
  process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']
  );
}

export function getAdminApp(): App {
  if (_adminApp) return _adminApp;
  if (!hasAdminEnv()) {
    throw new Error('Firebase admin env vars not set (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID)');
  }
  const adminConfig = {
    credential: cert({
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] as string,
  clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] as string,
  privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n') as string,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };
  if (getApps().length > 0) {
    _adminApp = getApps()[0];
  } else {
    _adminApp = initializeApp(adminConfig as any);
  }
  return _adminApp;
}

export function getAdminDb(): Firestore {
  if (_adminDb) return _adminDb;
  const app = getAdminApp();
  _adminDb = getFirestore(app);
  return _adminDb;
}

export function getAdminStorage(): Storage {
  if (_adminStorage) return _adminStorage;
  const app = getAdminApp();
  _adminStorage = getStorage(app);
  return _adminStorage;
}

export default {
  getAdminApp,
  getAdminDb,
  getAdminStorage,
};
