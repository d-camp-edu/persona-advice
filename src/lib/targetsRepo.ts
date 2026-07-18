import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Target, TargetCampaign, TargetCompletion } from '../types';
import { getDb, isFirebaseConfigured } from './firebase';
import { collectionPath, docPath } from './firestoreApi';

const CAMPAIGNS = 'targetCampaigns';
const TARGETS = 'targets';
const COMPLETIONS = 'targetCompletions';

// ── 캠페인 ────────────────────────────────────────────────────────────────
export async function loadCampaigns(): Promise<TargetCampaign[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, collectionPath(CAMPAIGNS)));
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TargetCampaign, 'id'>) }));
  items.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
  return items;
}

export async function saveCampaign(c: TargetCampaign): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { id, ...rest } = c;
  await setDoc(doc(db, docPath(CAMPAIGNS, id)), rest);
}

export async function deleteCampaign(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, docPath(CAMPAIGNS, id)));
}

// ── 타겟처 ────────────────────────────────────────────────────────────────
export async function uploadTargets(targets: Target[]): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase 미구성 — 타겟처를 업로드할 수 없습니다.');
  // Firestore batch 는 500 write 한도가 있어 청크로 나눠 커밋한다.
  const CHUNK = 400;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const t of targets.slice(i, i + CHUNK)) {
      const { id, ...rest } = t;
      batch.set(doc(db, docPath(TARGETS, id)), rest);
    }
    await batch.commit();
  }
}

/** 특정 캠페인의 기존 타겟처를 모두 삭제(엑셀 재업로드로 교체할 때) */
export async function deleteTargetsByCampaign(campaignId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const snap = await getDocs(
    query(collection(db, collectionPath(TARGETS)), where('campaignId', '==', campaignId)),
  );
  if (snap.empty) return;
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }
}

export async function loadAllTargets(campaignId?: string): Promise<Target[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const base = collection(db, collectionPath(TARGETS));
  const snap = await getDocs(
    campaignId ? query(base, where('campaignId', '==', campaignId)) : base,
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Target, 'id'>) }));
}

/** 담당자 사번으로 타겟처 조회 (로그인 검색). campaignIds 가 주어지면 그 캠페인들로 한정. */
export async function loadTargetsByEmp(
  empNo: string,
  campaignIds?: string[],
): Promise<Target[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, collectionPath(TARGETS)), where('empNo', '==', empNo)),
  );
  let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Target, 'id'>) }));
  if (campaignIds && campaignIds.length > 0) {
    const set = new Set(campaignIds);
    items = items.filter((t) => set.has(t.campaignId));
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return items;
}

// ── 완료 기록 ─────────────────────────────────────────────────────────────
export async function saveTargetCompletion(c: TargetCompletion): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const db = getDb();
  if (!db) return;
  const { id, ...rest } = c;
  await setDoc(doc(db, docPath(COMPLETIONS, id)), rest);
}

export async function loadAllCompletions(campaignId?: string): Promise<TargetCompletion[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const base = collection(db, collectionPath(COMPLETIONS));
  const snap = await getDocs(
    campaignId ? query(base, where('campaignId', '==', campaignId)) : base,
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TargetCompletion, 'id'>) }));
}

export async function loadCompletionsByEmp(
  empNo: string,
  campaignIds?: string[],
): Promise<TargetCompletion[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, collectionPath(COMPLETIONS)), where('empNo', '==', empNo)),
  );
  let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TargetCompletion, 'id'>) }));
  if (campaignIds && campaignIds.length > 0) {
    const set = new Set(campaignIds);
    items = items.filter((c) => set.has(c.campaignId));
  }
  return items;
}
