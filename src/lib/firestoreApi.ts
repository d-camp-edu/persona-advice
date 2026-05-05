import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb, APP_ID, isFirebaseConfigured } from './firebase';

const PUBLIC_BASE = `artifacts/${APP_ID}/public/data`;

export const collectionPath = (name: string) => `${PUBLIC_BASE}/${name}`;
export const docPath = (collectionName: string, id: string) =>
  `${PUBLIC_BASE}/${collectionName}/${id}`;

const noopUnsub: Unsubscribe = () => {};

/**
 * 컬렉션 onSnapshot 구독. Firebase 미구성 시 즉시 빈 배열을 콜백에 한 번 전달하고
 * no-op unsubscribe를 반환한다.
 */
export function subscribeCollection<T extends { id: string }>(
  name: string,
  onChange: (items: T[]) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    onChange([]);
    return noopUnsub;
  }
  const db = getDb();
  if (!db) {
    onChange([]);
    return noopUnsub;
  }
  return onSnapshot(collection(db, collectionPath(name)), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    onChange(items);
  });
}

/**
 * 단일 문서 onSnapshot 구독 (settings/global 같은 단일 문서용).
 */
export function subscribeDoc<T>(
  name: string,
  id: string,
  onChange: (data: T | null) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    onChange(null);
    return noopUnsub;
  }
  const db = getDb();
  if (!db) {
    onChange(null);
    return noopUnsub;
  }
  return onSnapshot(doc(db, docPath(name, id)), (d) => {
    onChange(d.exists() ? (d.data() as T) : null);
  });
}

export async function saveDoc<T extends Record<string, unknown>>(
  name: string,
  id: string,
  data: T,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await setDoc(doc(db, docPath(name, id)), data);
}

export async function removeDoc(name: string, id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, docPath(name, id)));
}

/**
 * 시드 일괄 업로드용 batch write. seedRunner.uploadAll()에서만 사용.
 */
export async function batchUploadCollection<T extends { id: string }>(
  name: string,
  items: T[],
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase not configured — cannot upload seed.');
  const batch = writeBatch(db);
  for (const item of items) {
    const { id, ...rest } = item;
    batch.set(doc(db, docPath(name, id)), rest);
  }
  await batch.commit();
}
