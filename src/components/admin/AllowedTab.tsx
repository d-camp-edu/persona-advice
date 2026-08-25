import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { useDraftAutoSave, SaveStatusBadge } from './useDraftAutoSave';
import type { AllowedCombination } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newAllowed(): AllowedCombination {
  return {
    id: `ac_${Date.now().toString(36)}`,
    name: '새 허용 조합',
    classIds: [],
    note: '',
  };
}

function CombCard({
  item,
  drugClasses,
  saving,
  onSave,
  onDelete,
}: {
  item: AllowedCombination;
  drugClasses: { id: string; name: string }[];
  saving: boolean;
  onSave: (a: AllowedCombination) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<AllowedCombination>(() => structuredClone(item));
  // 체크만 하고 저장을 안 눌러 설정이 유실되던 문제 → 자동 저장.
  const { status, saveNow } = useDraftAutoSave(draft, onSave);

  const toggleClass = (id: string) => {
    const cur = draft.classIds;
    setDraft((d) => ({
      ...d,
      classIds: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
    }));
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-end">
        <SaveStatusBadge status={status} />
      </div>
      <label className="mb-0.5 block text-xs text-gray-500">이름</label>
      <input
        className={`${inp} mb-2`}
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
      />
      <label className="mb-0.5 block text-xs text-gray-500">비고</label>
      <input
        className={`${inp} mb-3`}
        value={draft.note}
        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
        placeholder="설명 (선택)"
      />
      <p className="mb-1 text-xs text-gray-500">허용할 계열 조합</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {drugClasses.map((dc) => (
          <label key={dc.id} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={draft.classIds.includes(dc.id)}
              onChange={() => toggleClass(dc.id)}
              className="h-3.5 w-3.5"
            />
            {dc.name}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={saving || status === 'saving'}
          className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving || status === 'saving' ? '저장 중…' : '지금 저장'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AllowedTab() {
  const items = useDataStore((s) => s.allowedCombinations);
  const drugClasses = useDataStore((s) => s.drugClasses);
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async (item: AllowedCombination) => {
    setSaving(item.id);
    const { id, ...rest } = item;
    try {
      await saveDoc('allowedCombinations', id, rest as Record<string, unknown>);
      showFlash('저장됨');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 조합을 삭제하시겠습니까?')) return;
    await removeDoc('allowedCombinations', id);
  };

  const handleAdd = () => void handleSave(newAllowed());

  return (
    <div>
      <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
        <p className="mb-1 font-semibold text-gray-700">허용 조합은 삭감 규칙보다 상위입니다.</p>
        <p className="mb-1.5">
          여기에 등록된 <strong className="text-gray-800">계열 조합 전체가 처방에 포함</strong>되어야
          면제됩니다. 처방에 없는 계열이 하나라도 섞여 있으면 그 조합은 적용되지 않으니, 실제 처방
          단위로 정확히 등록하세요.
        </p>
        <p className="mb-0.5">
          <span className="font-medium text-emerald-700">면제됨</span> — 계열 조합을 근거로 하는 삭감:
          병용 금지 규칙, 동일 계열 중복, 급여 N제 초과, 1차 메트포르민 미사용, 병용 요법 1차약제 미포함
        </p>
        <p>
          <span className="font-medium text-amber-700">유지됨</span> — HbA1c 수치를 근거로 하는 삭감:
          초기 HbA1c 6.5% 미만, 2제·추가 병용 기준 미달
        </p>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className="mb-3 flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-3.5 w-3.5" />
        새 허용 조합
      </button>
      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      {items.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">등록된 허용 조합이 없습니다.</p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <CombCard
            key={item.id}
            item={item}
            drugClasses={drugClasses}
            saving={saving === item.id}
            onSave={handleSave}
            onDelete={() => void handleDelete(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
