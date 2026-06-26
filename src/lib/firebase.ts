import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from 'firebase/auth';
import { firebaseConfig, APP_ID, isFirebaseConfigured, isStorageConfigured } from './firebaseConfig';

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
    // ignoreUndefinedProperties: 선택 필드(customEffects, brochureUrl 등)가 undefined여도
    // setDoc이 throw하지 않도록 한다. (저장이 조용히 실패해 수정 내용이 날아가는 문제 방지)
    dbInstance = initializeFirestore(appInstance, { ignoreUndefinedProperties: true });
    authInstance = getAuth(appInstance);
  }
  return { app: appInstance, db: dbInstance, auth: authInstance };
}

export async function ensureAnonymousAuth(): Promise<string | null> {
  const { auth } = initFirebase();
  if (!auth) return null;
  // onAuthStateChanged로 SDK 초기화 완료를 기다린 후 처리
  // (auth.currentUser 직접 체크 시 Firestore 토큰 전파 전에 permission-denied 발생하는 문제 방지)
  return new Promise<string | null>((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        unsub();
        try {
          if (user) {
            resolve(user.uid);
          } else {
            const cred = await signInAnonymously(auth);
            resolve(cred.user.uid);
          }
        } catch (e) {
          reject(e);
        }
      },
      reject,
    );
  });
}

export function getDb(): Firestore | null {
  return initFirebase().db;
}

export { APP_ID, isFirebaseConfigured, isStorageConfigured };
