import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import type { SideEffectExemption } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newExemption(): SideEffectExemption {
  return {
    id: `se_${Date.now().toString(36)}`,
    name: '새 면제 설정',
    classIds: [],
    note: '',
  };
}

function ExCard({
  item,
  drugClasses,
  saving,
  onSave,
  onDelete,
}: {
  item: SideEffectExemption;
  drugClasses: { id: string; name: string }[];
  saving: boolean;
  onSave: (e: SideEffectExemption) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<SideEffectExemption>(() => structuredClone(item));

  const toggleClass = (id: string) => {
    const cur = draft.classIds;
    setDraft((d) => ({
      ...d,
      classIds: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id],
    }));
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
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
      <p className="mb-1 text-xs text-gray-500">이 계열 조합 처방 시 부작용 면제</p>
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
          onClick={() => onSave(draft)}
          disabled={saving}
          className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
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

export default function ExemptionsTab() {
  const items = useDataStore((s) => s.sideEffectExemptions);
  const drugClasses = useDataStore((s) => s.drugClasses);
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async (item: SideEffectExemption) => {
    setSaving(item.id);
    const { id, ...rest } = item;
    try {
      await saveDoc('sideEffectExemptions', id, rest as Record<string, unknown>);
      showFlash('저장됨');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 설정을 삭제하시겠습니까?')) return;
    await removeDoc('sideEffectExemptions', id);
  };

  const handleAdd = () => void handleSave(newExemption());

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        특정 계열 조합 처방 시 부작용 발생을 면제합니다. (예: 위장장애 발생 억제 조합)
      </p>
      <button
        type="button"
        onClick={handleAdd}
        className="mb-3 flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-3.5 w-3.5" />
        새 면제 설정
      </button>
      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      {items.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">등록된 면제 설정이 없습니다.</p>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <ExCard
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
