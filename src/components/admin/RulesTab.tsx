import { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import type { DeductionRule } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newRule(): DeductionRule {
  return {
    id: `dr_${Date.now().toString(36)}`,
    name: '새 삭감 규칙',
    classIds: [],
    message: '',
    enabled: true,
  };
}

export default function RulesTab() {
  const rules = useDataStore((s) => s.deductionRules);
  const drugClasses = useDataStore((s) => s.drugClasses);
  const [saving, setSaving] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async (rule: DeductionRule) => {
    setSaving(rule.id);
    const { id, ...rest } = rule;
    try {
      await saveDoc('deductionRules', id, rest as Record<string, unknown>);
      showFlash('저장됨');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 규칙을 삭제하시겠습니까?')) return;
    await removeDoc('deductionRules', id);
  };

  const handleAdd = () => void handleSave(newRule());

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        DPP-4i + GLP-1 RA 병용 금지는 내장 규칙입니다. 아래에 추가 규칙을 설정하세요.
      </p>
      <button
        type="button"
        onClick={handleAdd}
        className="mb-3 flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        <Plus className="h-3.5 w-3.5" />
        새 규칙
      </button>
      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      {rules.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">등록된 추가 규칙이 없습니다.</p>
      )}

      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            drugClasses={drugClasses}
            saving={saving === rule.id}
            onSave={handleSave}
            onDelete={() => void handleDelete(rule.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  drugClasses,
  saving,
  onSave,
  onDelete,
}: {
  rule: DeductionRule;
  drugClasses: { id: string; name: string }[];
  saving: boolean;
  onSave: (r: DeductionRule) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<DeductionRule>(() => structuredClone(rule));

  const toggleClass = (id: string) => {
    const cur = draft.classIds;
    setDraft((d) => ({ ...d, classIds: cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id] }));
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <input
          className={`${inp} flex-1`}
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="규칙 이름"
        />
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
          className="text-gray-400 hover:text-indigo-600"
          title={draft.enabled ? '비활성화' : '활성화'}
        >
          {draft.enabled ? (
            <ToggleRight className="h-6 w-6 text-indigo-600" />
          ) : (
            <ToggleLeft className="h-6 w-6" />
          )}
        </button>
      </div>

      <label className="mb-0.5 block text-xs text-gray-500">삭감 메시지</label>
      <input
        className={`${inp} mb-3`}
        value={draft.message}
        onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
        placeholder="삭감 사유 메시지"
      />

      <p className="mb-1 text-xs text-gray-500">병용 금지 계열 (2개 이상 선택 시 해당 조합 처방이면 삭감)</p>
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
