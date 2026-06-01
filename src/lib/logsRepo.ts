import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import type { GiftLog, SurveyResponse } from '../types';
import { getDb, isFirebaseConfigured } from './firebase';
import { collectionPath, docPath } from './firestoreApi';

const SURVEY_COLL = 'surveyResponses';
const GIFT_COLL = 'giftLogs';

export async function loadAllSurveyResponses(): Promise<SurveyResponse[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, collectionPath(SURVEY_COLL)));
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SurveyResponse, 'id'>) }));
  items.sort((a, b) => (a.answeredAt < b.answeredAt ? 1 : a.answeredAt > b.answeredAt ? -1 : 0));
  return items;
}

export async function loadAllGiftLogs(): Promise<GiftLog[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, collectionPath(GIFT_COLL)));
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GiftLog, 'id'>) }));
  items.sort((a, b) => (a.spunAt < b.spunAt ? 1 : a.spunAt > b.spunAt ? -1 : 0));
  return items;
}

export async function saveGiftLog(log: GiftLog): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const db = getDb();
  if (!db) return;
  const { id, ...rest } = log;
  await setDoc(doc(db, docPath(GIFT_COLL, id)), rest);
}

async function deleteCollection(name: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const db = getDb();
  if (!db) return;
  const snap = await getDocs(collection(db, collectionPath(name)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
}

export async function deleteAllSurveyResponses(): Promise<void> {
  await deleteCollection(SURVEY_COLL);
}

export async function deleteAllGiftLogs(): Promise<void> {
  await deleteCollection(GIFT_COLL);
}
