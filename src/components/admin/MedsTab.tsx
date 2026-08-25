import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileUp, GripVertical, Plus, Star, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { downloadWorkbook } from '../../lib/excel';
import { uploadMedications, uploadMedicationList } from '../../data/seedRunner';
import { parseMedicationsXlsx } from '../../lib/medExcelImport';
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
  const metricDefs = useDataStore((s) => s.patientMetricDefs);
  const customDefs = metricDefs.filter((d) => !d.isBuiltIn && d.enabled).sort((a, b) => a.order - b.order);
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

      {/* 커스텀 검사 지표 효과 (환자 프로파일에서 추가한 지표) */}
      {customDefs.length > 0 && (
        <>
          <p className="mb-1 text-xs font-semibold text-gray-600">커스텀 검사 지표 효과</p>
          <div className="mb-3 grid grid-cols-2 gap-x-3">
            {customDefs.map((def) => (
              <div key={def.id}>
                <label className="mb-0.5 block text-xs text-gray-500">
                  {def.label}{def.unit ? ` (${def.unit})` : ''} 변화
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={`${inp} mb-1`}
                  value={draft.customEffects?.[def.id] ?? 0}
                  onChange={(e) =>
                    set('customEffects', { ...draft.customEffects, [def.id]: +e.target.value })
                  }
                />
              </div>
            ))}
          </div>
        </>
      )}

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

/** 환자 프로파일의 커스텀 지표 중 AST/ALT/γ-GTP(간수치) 지표 id를 라벨로 찾는다. */
function findLiverMetricIds(defs: { id: string; label: string; isBuiltIn: boolean }[]) {
  const norm = (s: string) => s.trim().toUpperCase().replace(/[\s._-]/g, '');
  let ast: string | undefined;
  let alt: string | undefined;
  let ggtp: string | undefined;
  for (const d of defs) {
    if (d.isBuiltIn) continue;
    const n = norm(d.label);
    if (n === 'AST') ast = d.id;
    else if (n === 'ALT') alt = d.id;
    else if (n.includes('GTP') || n.includes('GGT')) ggtp = d.id;
  }
  return { ast, alt, ggtp };
}

/** 계열별 AST·ALT·γ-GTP 처방 효과값 [AST, ALT, γ-GTP] */
const LIVER_CLASS_EFFECTS = {
  tzd: [-5, -13, -13],
  sglt2: [-4, -10, -13],
  both: [-15, -22, -29],
} as const;

export default function MedsTab() {
  const medications = useDataStore((s) => s.medications);
  const categories = useDataStore((s) => s.medCategories);
  const drugClasses = useDataStore((s) => s.drugClasses);
  const metricDefs = useDataStore((s) => s.patientMetricDefs);
  const medsEmpty = useDataStore((s) => s.medsEmpty);
  const medCategoriesEmpty = useDataStore((s) => s.medCategoriesEmpty);
  const drugClassesEmpty = useDataStore((s) => s.drugClassesEmpty);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [applying, setApplying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  /**
   * 지금 Firestore 에 있는 약제를 그대로 엑셀로 내려받는다.
   * '엑셀 반영'·'기본 초기화'는 약제 문서를 통째로 덮어쓰므로, 관리자에서 손으로 고쳐둔
   * 값이 있으면 되돌릴 방법이 없다. 덮어쓰기 전 백업용.
   */
  const handleBackup = () => {
    const classNameOf = (id: string) => drugClasses.find((c) => c.id === id)?.name ?? id;
    downloadWorkbook(`약제백업_${new Date().toISOString().slice(0, 10)}.xls`, [
      {
        name: '약제',
        headers: [
          'id', '약제명', '주성분', '카테고리', '포장', '계열(이름)', '계열(id)', '비약물',
          'HbA1c강하', '체중', 'LVEF', 'BNP', 'NT-proBNP', 'eGFR연간', 'eGFR딥', 'UACR',
          '호전공병', '악화공병', '부작용확률', '부작용페널티', '부작용메시지',
          'eGFR하한', 'HFrEF특례', 'HFpEF특례', 'CKD특례', '보험예외', '2TQD', '아사제품', '정렬',
        ],
        rows: medications.map((m) => [
          m.id, m.name, m.ingredient ?? '', m.categoryId, m.pkg,
          m.classes.map(classNameOf).join(' + '), m.classes.join('|'), m.isNotDrug ? 'O' : '',
          m.effect, m.effectWeight, m.effectLvef, m.effectBnp, m.effectNtprobnp,
          m.effectEgfr, m.effectEgfrDip, m.effectUacr,
          m.beneficialComorb.join('; '), m.worseningComorb.join('; '),
          m.sideEffectProb, m.sideEffectPenalty, m.sideEffectMsg,
          m.egfrLimit, m.allowHFrEFCoverage ? 'O' : '', m.allowHFpEFCoverage ? 'O' : '',
          m.allowCkdCoverage ? 'O' : '', m.isInsuranceException ? 'O' : '',
          m.allow2TQD ? 'O' : '', m.isAsaProduct ? 'O' : '', m.order,
        ]),
      },
    ]);
    showFlash(`현재 약제 ${medications.length}종 백업 저장됨`);
  };

  /** 사용자가 수정한 '기본 약제 초기화.xlsx' 를 선택 → 파싱 → 업로드 */
  const handleXlsxImport = async (file: File) => {
    setImporting(true);
    try {
      const meds = await parseMedicationsXlsx(file);
      await uploadMedicationList(meds);
      showFlash(`엑셀 반영됨 (${meds.length}종)`);
    } catch (e) {
      showFlash(`반영 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
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

  /** TZD/SGLT-2i 계열 약제에 AST·ALT·γ-GTP 계열 기준값을 일괄 채워 저장한다. */
  const handleApplyLiverClassEffects = async () => {
    const { ast, alt, ggtp } = findLiverMetricIds(metricDefs);
    if (!ast || !alt || !ggtp) {
      showFlash('AST·ALT·γ-GTP 지표를 먼저 환자 프로파일에 추가하세요');
      return;
    }
    const targets = medications.filter(
      (m) => m.classes.includes('dc_tzd') || m.classes.includes('dc_sglt2'),
    );
    if (targets.length === 0) {
      showFlash('TZD·SGLT-2i 계열 약제가 없습니다');
      return;
    }
    if (!confirm(`TZD·SGLT-2i 계열 약제 ${targets.length}종에 AST·ALT·γ-GTP 계열 기준값을 적용하시겠습니까?`))
      return;

    setApplying(true);
    try {
      const updated = targets.map((m) => {
        const hasTzd = m.classes.includes('dc_tzd');
        const hasSglt2 = m.classes.includes('dc_sglt2');
        const vals =
          hasTzd && hasSglt2
            ? LIVER_CLASS_EFFECTS.both
            : hasTzd
              ? LIVER_CLASS_EFFECTS.tzd
              : LIVER_CLASS_EFFECTS.sglt2;
        const customEffects = {
          ...m.customEffects,
          [ast]: vals[0],
          [alt]: vals[1],
          [ggtp]: vals[2],
        };
        return { ...m, customEffects };
      });

      if (medsEmpty) {
        const byId = new Map(updated.map((m) => [m.id, m]));
        await materializeAll(medications.map((m) => byId.get(m.id) ?? m));
      } else {
        await Promise.all(
          updated.map((m) => {
            const { id, ...rest } = m;
            return saveDoc('medications', id, rest as unknown as Record<string, unknown>);
          }),
        );
      }
      showFlash(`계열값 적용됨 (${updated.length}종)`);
    } catch {
      showFlash('적용 실패');
    } finally {
      setApplying(false);
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
          className="flex flex-1 items-center justify-between gap-2 py-3 pr-4 text-left hover:bg-gray-50"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {m.isAsaProduct && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
              <span className="text-sm font-medium text-gray-900">{m.name}</span>
              <span className="text-xs text-gray-400">↓{m.effect}</span>
            </div>
            {/* 계열·성분을 목록에서 바로 보여준다 — 계열이 빠진 약제는 삭감 판정이 조용히
                어긋나므로(실제로 겪었다) 펼치지 않고도 눈에 띄어야 한다. */}
            <div className="mt-0.5 text-[11px] leading-snug">
              {m.isNotDrug ? (
                <span className="text-gray-400">비약물</span>
              ) : m.classes.length === 0 ? (
                <span className="font-medium text-red-500">⚠ 계열 미지정 — 삭감 판정이 어긋납니다</span>
              ) : (
                <span className="text-indigo-600">
                  {m.classes.map((id) => drugClasses.find((c) => c.id === id)?.name ?? `?${id}`).join(' + ')}
                </span>
              )}
              {m.ingredient ? (
                <span className="ml-1.5 text-gray-500">{m.ingredient.split('/').join(' + ')}</span>
              ) : (
                !m.isNotDrug && <span className="ml-1.5 text-amber-600">성분 미등록</span>
              )}
            </div>
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
          disabled={seeding || importing || applying}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {seeding ? '초기화 중…' : `기본 초기화 (${seedMedications.length}종)`}
        </button>
        <button
          type="button"
          onClick={handleBackup}
          disabled={medications.length === 0}
          title="지금 Firestore 에 있는 약제를 엑셀로 내려받습니다 (덮어쓰기 전 백업)"
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          현재 약제 백업
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={seeding || importing || applying}
          className="flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          <FileUp className="h-3.5 w-3.5" />
          {importing ? '반영 중…' : '엑셀 반영'}
        </button>
        <button
          type="button"
          onClick={() => void handleApplyLiverClassEffects()}
          disabled={seeding || importing || applying}
          className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
        >
          {applying ? '적용 중…' : 'AST·ALT·γ-GTP 계열값 일괄 적용'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleXlsxImport(f);
          }}
        />
      </div>
      <p className="mb-3 text-[11px] leading-snug text-gray-400">
        카테고리 → 계열 순으로 묶여 있습니다. 같은 계열 안에서 <strong>왼쪽 손잡이를 드래그</strong>해 순서를
        바꾸세요. 계열 그룹 순서는 <strong>설정 › 약물 계열 관리</strong>에서 조정합니다.
        <br />
        <strong className="text-emerald-700">엑셀 반영</strong>: 수정한 <strong>‘기본 약제 초기화.xlsx’</strong>를
        선택하면 계열 수로 구분(단일제·2제·메폴민 2제·3제)을 자동 판정하고, <strong>계열·주성분</strong>을
        엑셀 기준으로 채워 업로드합니다. 처방 화면에 <strong>성분</strong>이 안 보이거나 <strong>계열</strong>이
        비어 있으면 이 버튼으로 한 번 올리면 채워집니다.
        <br />
        <strong className="text-red-500">주의</strong>: 엑셀 반영·기본 초기화는 약제 문서를 통째로 덮어씁니다.
        여기서 손으로 고쳐둔 값이 있으면 먼저 <strong>‘현재 약제 백업’</strong>으로 내려받아 두세요.
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
