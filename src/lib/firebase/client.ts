import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getClientApp(): FirebaseApp | null {
  if (!isBrowser()) return null;
  if (_app) return _app;
  // avoid initializing if config is missing
  if (!firebaseConfig.apiKey) return null;
  _app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  return _app;
}

export function getClientAuth(): Auth | null {
  const app = getClientApp();
  if (!app) return null;
  if (_auth) return _auth;
  _auth = getAuth(app);
  return _auth;
}

export function getClientDb(): Firestore | null {
  const app = getClientApp();
  if (!app) return null;
  if (_db) return _db;
  _db = getFirestore(app);
  return _db;
}

export function getClientStorage(): FirebaseStorage | null {
  const app = getClientApp();
  if (!app) return null;
  if (_storage) return _storage;
  _storage = getStorage(app);
  return _storage;
}
