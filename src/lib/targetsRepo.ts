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
import type { Product, Target, TargetCampaign, TargetCompletion } from '../types';
import { getDb, isFirebaseConfigured } from './firebase';
import { collectionPath, docPath } from './firestoreApi';

const PRODUCTS = 'products';
const CAMPAIGNS = 'targetCampaigns';
const TARGETS = 'targets';
const COMPLETIONS = 'targetCompletions';

// ── 품목 ─────────────────────────────────────────────────────────────────
export async function saveProduct(p: Product): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { id, ...rest } = p;
  await setDoc(doc(db, docPath(PRODUCTS, id)), rest);
}

export async function deleteProduct(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, docPath(PRODUCTS, id)));
}

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

/** 타겟처 1건 저장(추가·수정 공용). 같은 id면 덮어쓴다. */
export async function saveTarget(t: Target): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase 미구성 — 타겟처를 저장할 수 없습니다.');
  const { id, ...rest } = t;
  await setDoc(doc(db, docPath(TARGETS, id)), rest);
}

/** 타겟처 1건 삭제 */
export async function deleteTarget(id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase 미구성 — 타겟처를 삭제할 수 없습니다.');
  await deleteDoc(doc(db, docPath(TARGETS, id)));
}

/** 타겟처 여러 건 삭제 (batch 400개 청크) */
export async function deleteTargets(ids: string[]): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Firebase 미구성 — 타겟처를 삭제할 수 없습니다.');
  const CHUNK = 400;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + CHUNK)) {
      batch.delete(doc(db, docPath(TARGETS, id)));
    }
    await batch.commit();
  }
}

/**
 * 지정한 타겟처들의 '진행 완료' 기록을 삭제한다.
 * 완료 문서 id 는 `${campaignId}__${targetId}` 규칙이라 조회 없이 바로 지울 수 있다.
 */
export async function deleteCompletionsByTargets(
  campaignId: string,
  targetIds: string[],
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const CHUNK = 400;
  for (let i = 0; i < targetIds.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const tid of targetIds.slice(i, i + CHUNK)) {
      batch.delete(doc(db, docPath(COMPLETIONS, `${campaignId}__${tid}`)));
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
