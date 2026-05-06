import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { uploadMedications } from '../../data/seedRunner';
import type { Medication, Pkg } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newMed(): Medication {
  return {
    id: `m_${Date.now().toString(36)}`,
    name: '새 약제',
    categoryId: 'cat_1',
    pkg: 'ptp',
    classes: [],
    isNotDrug: false,
    effect: 0,
    effectWeight: 0,
    effectLvef: 0,
    effectBnp: 0,
    effectNtprobnp: 0,
    effectEgfr: 0,
    effectUacr: 0,
    beneficialComorb: [],
    worseningComorb: [],
    sideEffectProb: 0,
    sideEffectPenalty: 0,
    sideEffectMsg: '',
    egfrLimit: 0,
    allowHFrEFCoverage: false,
    allowHFpEFCoverage: false,
    allowCkdCoverage: false,
    isInsuranceException: false,
    allow2TQD: false,
    order: 99,
  };
}

function MedEditor({
  med,
  onSave,
  onDelete,
}: {
  med: Medication;
  onSave: (m: Medication) => Promise<void>;
  onDelete: () => void;
}) {
  const categories = useDataStore((s) => s.medCategories);
  const drugClasses = useDataStore((s) => s.drugClasses);
  const comorbNames = useDataStore((s) => s.settings.comorbidities.map((c) => c.name));
  const [draft, setDraft] = useState<Medication>(() => structuredClone(med));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Medication>(k: K, v: Medication[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const toggleArr = (key: 'classes' | 'beneficialComorb' | 'worseningComorb', val: string) => {
    const cur = draft[key] as string[];
    set(key, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
      <div className="grid grid-cols-2 gap-x-3">
        <div className="col-span-2">
          <label className="mb-0.5 block text-xs text-gray-500">약제명</label>
          <input className={`${inp} mb-2`} value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">카테고리</label>
          <select className={`${inp} mb-2`} value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.sort((a, b) => a.order - b.order).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">포장</label>
          <select className={`${inp} mb-2`} value={draft.pkg} onChange={(e) => set('pkg', e.target.value as Pkg)}>
            <option value="ptp">PTP (낱알)</option>
            <option value="bottle">Bottle (병포장)</option>
            <option value="injection">Injection (주사)</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">순서</label>
          <input type="number" className={`${inp} mb-2`} value={draft.order} onChange={(e) => set('order', +e.target.value)} />
        </div>
      </div>

      {/* 플래그 */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {(
          [
            { k: 'isNotDrug', label: '비약물' },
            { k: 'isInsuranceException', label: '보험 예외' },
            { k: 'allow2TQD', label: '2TQD 허용' },
            { k: 'allowHFrEFCoverage', label: 'HFrEF 특례' },
            { k: 'allowHFpEFCoverage', label: 'HFpEF 특례' },
            { k: 'allowCkdCoverage', label: 'CKD 특례' },
          ] as { k: keyof Medication; label: string }[]
        ).map(({ k, label }) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={draft[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="h-3.5 w-3.5" />
            {label}
          </label>
        ))}
      </div>

      {/* 효과 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">처방 효과</p>
      <div className="mb-3 grid grid-cols-2 gap-x-3">
        {(
          [
            { k: 'effect', label: 'HbA1c 강하' },
            { k: 'effectWeight', label: '체중 변화' },
            { k: 'effectLvef', label: 'LVEF 변화' },
            { k: 'effectBnp', label: 'BNP 변화' },
            { k: 'effectNtprobnp', label: 'NT-proBNP 변화' },
            { k: 'effectEgfr', label: 'eGFR 변화' },
            { k: 'effectUacr', label: 'UACR 변화' },
            { k: 'egfrLimit', label: 'eGFR 하한' },
          ] as { k: keyof Medication; label: string }[]
        ).map(({ k, label }) => (
          <div key={k}>
            <label className="mb-0.5 block text-xs text-gray-500">{label}</label>
            <input type="number" step="0.01" className={`${inp} mb-1`} value={draft[k] as number} onChange={(e) => set(k, +e.target.value)} />
          </div>
        ))}
      </div>

      {/* 부작용 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">부작용</p>
      <div className="mb-3 grid grid-cols-2 gap-x-3">
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">발생 확률 (0~1)</label>
          <input type="number" step="0.01" min="0" max="1" className={`${inp} mb-1`} value={draft.sideEffectProb} onChange={(e) => set('sideEffectProb', +e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">HbA1c 패널티</label>
          <input type="number" step="0.1" className={`${inp} mb-1`} value={draft.sideEffectPenalty} onChange={(e) => set('sideEffectPenalty', +e.target.value)} />
        </div>
      </div>
      <label className="mb-0.5 block text-xs text-gray-500">부작용 메시지</label>
      <input className={`${inp} mb-3`} value={draft.sideEffectMsg} onChange={(e) => set('sideEffectMsg', e.target.value)} />

      {/* 계열 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">약물 계열</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {drugClasses.map((dc) => (
          <label key={dc.id} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={draft.classes.includes(dc.id)} onChange={() => toggleArr('classes', dc.id)} className="h-3.5 w-3.5" />
            {dc.name}
          </label>
        ))}
      </div>

      {/* 공병증 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">공병증 — 호전</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {comorbNames.map((name) => (
          <label key={name} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={draft.beneficialComorb.includes(name)} onChange={() => toggleArr('beneficialComorb', name)} className="h-3.5 w-3.5" />
            {name}
          </label>
        ))}
      </div>
      <p className="mb-1 text-xs font-semibold text-gray-600">공병증 — 악화</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {comorbNames.map((name) => (
          <label key={name} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={draft.worseningComorb.includes(name)} onChange={() => toggleArr('worseningComorb', name)} className="h-3.5 w-3.5" />
            {name}
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('이 약제를 삭제하시겠습니까?')) onDelete();
          }}
          className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function MedsTab() {
  const medications = useDataStore((s) => s.medications);
  const categories = useDataStore((s) => s.medCategories);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const sorted = [...medications].sort((a, b) => {
    const oa = categories.find((c) => c.id === a.categoryId)?.order ?? 99;
    const ob = categories.find((c) => c.id === b.categoryId)?.order ?? 99;
    if (oa !== ob) return oa - ob;
    return a.order - b.order;
  });

  const handleSave = async (m: Medication) => {
    const { id, ...rest } = m;
    await saveDoc('medications', id, rest as unknown as Record<string, unknown>);
    showFlash('저장됨');
    setExpanded(null);
  };

  const handleDelete = async (id: string) => {
    await removeDoc('medications', id);
    setExpanded(null);
  };

  const handleAdd = async () => {
    const m = newMed();
    const { id, ...rest } = m;
    await saveDoc('medications', id, rest as unknown as Record<string, unknown>);
    setExpanded(m.id);
  };

  const handleSeedReset = async () => {
    if (!confirm('약제 데이터를 기본 60종으로 초기화하시겠습니까?')) return;
    setSeeding(true);
    try {
      await uploadMedications();
      showFlash('초기화됨');
    } catch {
      showFlash('초기화 실패');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          새 약제
        </button>
        <button
          type="button"
          onClick={() => void handleSeedReset()}
          disabled={seeding}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {seeding ? '초기화 중…' : '기본 초기화 (60종)'}
        </button>
      </div>
      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        {sorted.map((m) => {
          const catName = categories.find((c) => c.id === m.categoryId)?.name ?? m.categoryId;
          return (
            <div key={m.id}>
              <button
                type="button"
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">{m.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{catName} · ↓{m.effect}</span>
                </div>
                {expanded === m.id ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expanded === m.id && (
                <MedEditor
                  med={m}
                  onSave={handleSave}
                  onDelete={() => void handleDelete(m.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
