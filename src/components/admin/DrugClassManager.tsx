import { useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { ensureMaterialized } from '../../lib/persistSeed';
import { moveItem } from '../../lib/reorder';
import type { DrugClass } from '../../types';

const inpSm =
  'rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

/**
 * 약물 계열(DrugClass) 관리 — 추가/수정/삭제 + 드래그 정렬.
 * 정렬 순서는 약제 관리 화면에서 카테고리 내 계열 그룹 순서로 그대로 쓰인다.
 * 자체 draft 상태로 편집 후 '계열 저장'으로 한 번에 영속화한다.
 */
export default function DrugClassManager() {
  const drugClasses = useDataStore((s) => s.drugClasses);
  const drugClassesEmpty = useDataStore((s) => s.drugClassesEmpty);

  const [draft, setDraft] = useState<DrugClass[]>(() =>
    [...drugClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const update = (id: string, patch: Partial<DrugClass>) =>
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const add = () =>
    setDraft((d) => [
      ...d,
      {
        id: `dc_${Date.now().toString(36)}`,
        name: '새 계열',
        duplicatable: false,
        order: d.length + 1,
      },
    ]);

  const remove = (id: string) => {
    if (!confirm('이 계열을 삭제하시겠습니까?\n(이 계열로 묶여 있던 약제는 "기타" 그룹으로 이동합니다.)'))
      return;
    setDraft((d) => d.filter((c) => c.id !== id));
  };

  const handleDrop = (targetId: string) => {
    setDragOverId(null);
    if (!dragId) return;
    setDraft((d) => moveItem(d, dragId, targetId));
    setDragId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 화면 순서대로 order를 1..n으로 재부여
      const ordered = draft.map((c, i) => ({ ...c, order: i + 1 }));

      // 삭제된 항목 제거 (DB가 비어 있으면 없는 문서라 no-op)
      const keep = new Set(ordered.map((c) => c.id));
      const removed = drugClasses.filter((c) => !keep.has(c.id));
      await Promise.all(removed.map((c) => removeDoc('drugClasses', c.id)));

      if (drugClassesEmpty) {
        // 폴백 상태: 전체를 한 번에 올려 시드 유실 방지
        await ensureMaterialized('drugClasses', ordered, true);
      } else {
        await Promise.all(
          ordered.map((c) => {
            const { id, ...rest } = c;
            return saveDoc('drugClasses', id, rest as unknown as Record<string, unknown>);
          }),
        );
      }
      setDraft(ordered);
      showFlash('저장됨');
    } catch {
      showFlash('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-5 rounded-lg bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">약물 계열 관리</h3>
      <p className="mb-3 text-xs text-gray-500">
        약제 관리 화면에서 카테고리 안의 <strong className="text-gray-700">계열 그룹 순서</strong>로 사용됩니다.
        <strong className="text-gray-700"> 손잡이를 드래그</strong>해 순서를 바꾸세요. 수정 후 아래
        <strong className="text-gray-700"> 계열 저장</strong>을 눌러야 반영됩니다.
      </p>

      <div className="mb-3 space-y-1.5">
        {draft.map((c) => (
          <div
            key={c.id}
            draggable
            onDragStart={() => setDragId(c.id)}
            onDragEnd={() => {
              setDragId(null);
              setDragOverId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragId && dragId !== c.id && dragOverId !== c.id) setDragOverId(c.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(c.id);
            }}
            className={`flex items-center gap-2 rounded-lg border bg-gray-50 px-2 py-1.5 ${
              dragOverId === c.id ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'
            }`}
          >
            <span className="cursor-grab text-gray-300 active:cursor-grabbing" aria-label="드래그로 순서 변경">
              <GripVertical className="h-4 w-4" />
            </span>
            <input
              className={`${inpSm} flex-1`}
              value={c.name}
              onChange={(e) => update(c.id, { name: e.target.value })}
              placeholder="계열명 (예: SGLT-2i)"
            />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-gray-500">
              <input
                type="checkbox"
                checked={c.duplicatable}
                onChange={(e) => update(c.id, { duplicatable: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              중복허용
            </label>
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label="계열 삭제"
              className="flex items-center justify-center rounded border border-red-100 px-2 py-1.5 text-red-400 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
        >
          <Plus size={14} />
          계열 추가
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '계열 저장'}
        </button>
        {flash && <span className="text-sm font-medium text-indigo-600">{flash}</span>}
      </div>
    </div>
  );
}
