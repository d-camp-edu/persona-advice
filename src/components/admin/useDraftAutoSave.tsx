// 관리자 카드 편집용 자동 저장 훅.
//
// 배경: 허용 조합·삭감 규칙·부작용 면제 탭은 카드마다 로컬 draft 를 두고 '저장' 버튼을
// 눌러야 Firestore 에 반영됐다. 체크박스를 켜도 화면만 바뀌고 저장은 안 되는데 표시가
// 없어서, 설정을 해뒀다고 믿었는데 실제로는 비어 있는 사고가 실제로 발생했다.
//
// 그래서 ① 변경 후 잠시 멈추면 자동 저장하고, ② 저장 상태를 화면에 표시하고,
// ③ 카드를 접거나 탭을 옮겨(언마운트) 타이머가 끊겨도 미저장분을 즉시 밀어 넣는다.

import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface DraftAutoSave {
  status: SaveStatus;
  /** 디바운스를 기다리지 않고 지금 저장 (수동 '저장' 버튼용) */
  saveNow: () => Promise<void>;
}

export function useDraftAutoSave<T>(
  draft: T,
  onSave: (value: T) => void | Promise<void>,
  delay = 800,
): DraftAutoSave {
  const [status, setStatus] = useState<SaveStatus>('idle');

  // 마지막으로 저장에 성공한 스냅샷. 최초 draft 는 이미 저장된 값이다.
  const savedJson = useRef(JSON.stringify(draft));
  // onSave/draft 는 매 렌더 새로 만들어지므로 ref 로 최신값만 들고 간다.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const flush = async () => {
    const json = JSON.stringify(draftRef.current);
    if (json === savedJson.current) return;
    setStatus('saving');
    try {
      await saveRef.current(draftRef.current);
      savedJson.current = json;
      setStatus('saved');
    } catch (e) {
      console.error('[autosave] 저장 실패', e);
      setStatus('error');
    }
  };

  // 변경 감지 → 디바운스 저장
  useEffect(() => {
    if (JSON.stringify(draft) === savedJson.current) return;
    setStatus('dirty');
    const t = setTimeout(() => void flush(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, delay]);

  // 언마운트(카드 접기·탭 이동) 시 미저장분 강제 저장 — 타이머가 끊겨 유실되는 걸 막는다.
  useEffect(() => {
    return () => {
      if (JSON.stringify(draftRef.current) !== savedJson.current) {
        void saveRef.current(draftRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, saveNow: flush };
}

/** 저장 상태 배지. 자동 저장이 돌고 있다는 걸 사용자에게 계속 알려준다. */
export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const map: Record<Exclude<SaveStatus, 'idle'>, { text: string; cls: string }> = {
    dirty: { text: '변경됨 · 곧 저장', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    saving: { text: '저장 중…', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
    saved: { text: '저장됨', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    error: { text: '저장 실패 — 다시 시도하세요', cls: 'bg-red-50 text-red-600 border-red-200' },
  };
  const { text, cls } = map[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{text}</span>
  );
}
