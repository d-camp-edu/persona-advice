import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { firebaseConfig, APP_ID, isFirebaseConfigured } from './firebaseConfig';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

export function initFirebase(): {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
} {
  if (!isFirebaseConfigured()) {
    return { app: null, db: null, auth: null };
  }
  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance);
    authInstance = getAuth(appInstance);
  }
  return { app: appInstance, db: dbInstance, auth: authInstance };
}

export async function ensureAnonymousAuth(): Promise<string | null> {
  const { auth } = initFirebase();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export function getDb(): Firestore | null {
  return initFirebase().db;
}

export { APP_ID, isFirebaseConfigured };
