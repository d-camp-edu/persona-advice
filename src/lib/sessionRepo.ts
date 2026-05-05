import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import type { RxSession } from '../types';
import { getDb, isFirebaseConfigured } from './firebase';
import { collectionPath, docPath } from './firestoreApi';

const COLL = 'rx_sessions';

/**
 * 같은 sessionKey로 저장된 가장 최근 rx_session 문서를 가져온다.
 * orderBy 인덱스를 강제하지 않으려고 클라이언트에서 createdAt 내림차순 정렬한다.
 * Firebase 미구성 또는 매치 없음이면 null.
 */
export async function loadLatestRxSession(sessionKey: string): Promise<RxSession | null> {
  if (!isFirebaseConfigured()) return null;
  const db = getDb();
  if (!db) return null;
  const q = query(collection(db, collectionPath(COLL)), where('sessionKey', '==', sessionKey));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RxSession, 'id'>) }));
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return items[0];
}

/**
 * RxSession 전체 문서를 setDoc(merge 없이 덮어쓰기)로 저장한다.
 * Firebase 미구성 시 no-op.
 */
export async function saveRxSession(session: RxSession): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const db = getDb();
  if (!db) return;
  const { id, ...rest } = session;
  await setDoc(doc(db, docPath(COLL, id)), rest);
}
