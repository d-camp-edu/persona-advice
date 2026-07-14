import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Star, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { uploadMedications } from '../../data/seedRunner';
import { ensureMaterialized } from '../../lib/persistSeed';
import { moveItem } from '../../lib/reorder';
import { seedMedications } from '../../data/seed';
import type { Medication, Pkg } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

const NONE = '__none__';

function newMed(): Medication {
  return {
    id: `m_${Date.now().toString(36)}`,
    name: '새 약제',
    categoryId: 'cat_single',
    pkg: 'ptp',
    classes: [],
    isNotDrug: false,
    effect: 0,
    effectWeight: 0,
    effectLvef: 0,
    effectBnp: 0,
    effectNtprobnp: 0,
    effectEgfr: 0,
    effectEgfrDip: 0,
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
    isAsaProduct: false,
    order: 99,
  };
}

/** med.classes 중 계열 순서(order)가 가장 앞선 계열을 그룹 키로 사용 */
function primaryClassId(med: Medication, classOrder: Map<string, number>): string {
  if (!med.classes?.length) return NONE;
  let best = NONE;
  let bestOrder = Infinity;
  for (const c of med.classes) {
    const o = classOrder.get(c) ?? 999;
    if (o < bestOrder) {
      bestOrder = o;
      best = c;
    }
  }
  return best;
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
            {[...categories].sort((a, b) => a.order - b.order).map((c) => (
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
      </div>

      {/* 플래그 */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {(
          [
            { k: 'isAsaProduct', label: '아사 제품 (처방 슬롯 최상단)' },
            { k: 'isNotDrug', label: '비약물' },
            { k: 'isInsuranceException', label: '보험 예외' },
            { k: 'allow2TQD', label: '2TQD 허용' },
            { k: 'allowHFrEFCoverage', label: 'HFrEF 특례' },
            { k: 'allowHFpEFCoverage', label: 'HFpEF 특례' },
            { k: 'allowCkdCoverage', label: 'CKD 특례' },
          ] as { k: keyof Medication; label: string }[]
        ).map(({ k, label }) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={!!draft[k]} onChange={(e) => set(k, e.target.checked as Medication[typeof k])} className="h-3.5 w-3.5" />
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
            { k: 'effectEgfr', label: 'eGFR 연간 변화' },
            { k: 'effectEgfrDip', label: 'eGFR 이니셜딥(첫 노출)' },
            { k: 'effectUacr', label: 'UACR 변화' },
            { k: 'egfrLimit', label: 'eGFR 하한' },
          ] as { k: keyof Medication; label: string }[]
        ).map(({ k, label }) => (
          <div key={k}>
            <label className="mb-0.5 block text-xs text-gray-500">{label}</label>
            <input type="number" step="0.01" className={`${inp} mb-1`} value={draft[k] as number} onChange={(e) => set(k, +e.target.value as Medication[typeof k])} />
          </div>
        ))}
      </div>

      {/* 부작용 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">부작용</p>
      <div className="mb-3 grid grid-cols-2 gap-x-3">
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">발생 확률 (0~100)</label>
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
      <p className="mb-1.5 text-[11px] text-gray-400">
        체크한 계열 중 <strong>설정의 계열 순서</strong>가 가장 앞선 계열로 그룹이 묶입니다.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {[...drugClasses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((dc) => (
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
  const drugClasses = useDataStore((s) => s.drugClasses);
  const medsEmpty = useDataStore((s) => s.medsEmpty);
  const medCategoriesEmpty = useDataStore((s) => s.medCategoriesEmpty);
  const drugClassesEmpty = useDataStore((s) => s.drugClassesEmpty);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [flash, setFlash] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const grouped = useMemo(() => {
    const classOrder = new Map(drugClasses.map((d) => [d.id, d.order ?? 999]));
    const className = new Map(drugClasses.map((d) => [d.id, d.name]));
    const cats = [...categories].sort((a, b) => a.order - b.order);
    const knownCatIds = new Set(categories.map((c) => c.id));

    const buildGroups = (catMeds: Medication[]) => {
      const byClass = new Map<string, Medication[]>();
      for (const m of catMeds) {
        const pc = primaryClassId(m, classOrder);
        if (!byClass.has(pc)) byClass.set(pc, []);
        byClass.get(pc)!.push(m);
      }
      return [...byClass.entries()]
        .map(([clsId, meds]) => ({
          clsId,
          clsName: clsId === NONE ? '기타' : className.get(clsId) ?? clsId,
          clsOrder: clsId === NONE ? 9999 : classOrder.get(clsId) ?? 999,
          meds: [...meds].sort((a, b) => a.order - b.order),
        }))
        .sort((a, b) => a.clsOrder - b.clsOrder);
    };

    const out = cats
      .map((cat) => {
        const catMeds = medications.filter((m) => m.categoryId === cat.id);
        return { key: cat.id, name: cat.name, groups: buildGroups(catMeds), count: catMeds.length };
      })
      .filter((c) => c.count > 0);

    const orphans = medications.filter((m) => !knownCatIds.has(m.categoryId));
    if (orphans.length > 0) {
      out.push({ key: '__orphan__', name: '미분류', groups: buildGroups(orphans), count: orphans.length });
    }
    return out;
  }, [medications, categories, drugClasses]);

  /** 폴백(빈 컬렉션) 상태면 전체 시드를 먼저 materialize 해 데이터 유실을 막는다 */
  const materializeAll = async (nextMeds: Medication[]) => {
    await ensureMaterialized('medications', nextMeds, true);
    await ensureMaterialized('medCategories', categories, medCategoriesEmpty);
    await ensureMaterialized('drugClasses', drugClasses, drugClassesEmpty);
  };

  const handleSave = async (m: Medication) => {
    if (medsEmpty) {
      await materializeAll(medications.map((x) => (x.id === m.id ? m : x)));
    } else {
      const { id, ...rest } = m;
      await saveDoc('medications', id, rest as unknown as Record<string, unknown>);
    }
    showFlash('저장됨');
    setExpanded(null);
  };

  const handleDelete = async (id: string) => {
    if (medsEmpty) {
      await materializeAll(medications.filter((x) => x.id !== id));
    } else {
      await removeDoc('medications', id);
    }
    setExpanded(null);
  };

  const handleAdd = async () => {
    const m = newMed();
    if (medsEmpty) {
      await materializeAll([...medications, m]);
    } else {
      const { id, ...rest } = m;
      await saveDoc('medications', id, rest as unknown as Record<string, unknown>);
    }
    setExpanded(m.id);
  };

  /** 같은 계열 그룹 안에서 드래그 정렬. 기존 order 값들을 그룹 내에서만 재배치한다. */
  const handleDropInGroup = async (groupMeds: Medication[], targetId: string) => {
    setDragOverId(null);
    if (!dragId) return;
    const reordered = moveItem(groupMeds, dragId, targetId);
    setDragId(null);
    if (reordered === groupMeds) return; // dragId가 이 그룹 밖이면 변화 없음

    const slots = groupMeds.map((m) => m.order).sort((a, b) => a - b);
    const origOrder = new Map(groupMeds.map((m) => [m.id, m.order]));
    const updated = reordered.map((m, i) => ({ ...m, order: slots[i] }));
    const changed = updated.filter((m) => origOrder.get(m.id) !== m.order);
    if (changed.length === 0) return;

    if (medsEmpty) {
      const orderMap = new Map(updated.map((m) => [m.id, m.order]));
      await materializeAll(
        medications.map((m) => (orderMap.has(m.id) ? { ...m, order: orderMap.get(m.id)! } : m)),
      );
    } else {
      await Promise.all(
        changed.map((m) => {
          const { id, ...rest } = m;
          return saveDoc('medications', id, rest as unknown as Record<string, unknown>);
        }),
      );
    }
  };

  const handleSeedReset = async () => {
    if (!confirm(`약제 데이터를 기본 ${seedMedications.length}종으로 초기화하시겠습니까?`)) return;
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

  const renderRow = (m: Medication, groupMeds: Medication[]) => (
    <div
      key={m.id}
      draggable
      onDragStart={() => setDragId(m.id)}
      onDragEnd={() => {
        setDragId(null);
        setDragOverId(null);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (dragId && dragId !== m.id && dragOverId !== m.id) setDragOverId(m.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        void handleDropInGroup(groupMeds, m.id);
      }}
      className={dragOverId === m.id ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-300' : ''}
    >
      <div className="flex items-center border-b border-gray-100">
        <span
          className="flex cursor-grab items-center px-1.5 py-3 text-gray-300 active:cursor-grabbing"
          aria-label="드래그로 순서 변경"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => setExpanded(expanded === m.id ? null : m.id)}
          className="flex flex-1 items-center justify-between py-3 pr-4 text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-1.5">
            {m.isAsaProduct && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            <span className="text-sm font-medium text-gray-900">{m.name}</span>
            <span className="text-xs text-gray-400">↓{m.effect}</span>
          </div>
          {expanded === m.id ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>
      {expanded === m.id && (
        <MedEditor med={m} onSave={handleSave} onDelete={() => void handleDelete(m.id)} />
      )}
    </div>
  );

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
          {seeding ? '초기화 중…' : `기본 초기화 (${seedMedications.length}종)`}
        </button>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-gray-400">
        카테고리 → 계열 순으로 묶여 있습니다. 같은 계열 안에서 <strong>왼쪽 손잡이를 드래그</strong>해 순서를
        바꾸세요. 계열 그룹 순서는 <strong>설정 › 약물 계열 관리</strong>에서 조정합니다.
      </p>
      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      <div className="space-y-4">
        {grouped.map((cat) => (
          <div key={cat.key}>
            <h3 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              {cat.name}
            </h3>
            <div className="overflow-hidden rounded-lg bg-white shadow-sm">
              {cat.groups.map((g) => (
                <div key={g.clsId}>
                  <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500">
                    {g.clsName}
                  </div>
                  {g.meds.map((m) => renderRow(m, g.meds))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
