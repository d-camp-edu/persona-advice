import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileUp, FolderTree, GripVertical, Plus, Star, Trash2, Wrench } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { downloadWorkbook } from '../../lib/excel';
import { uploadMedications, uploadMedicationList } from '../../data/seedRunner';
import { parseMedicationsXlsx } from '../../lib/medExcelImport';
import { ensureMaterialized } from '../../lib/persistSeed';
import { moveItem } from '../../lib/reorder';
import { seedMedCategories, seedMedications } from '../../data/seed';
import { planCategoryTidy } from '../../lib/medCategoryTidy';
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
  const [repairing, setRepairing] = useState(false);
  const [tidying, setTidying] = useState(false);
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

  /**
   * 약제 데이터 점검·복구.
   *
   * Firestore 약제 문서의 `classes`(계열)·`ingredient`(주성분)가 비어 있거나 시드와
   * 어긋나면, 그 두 필드만 시드 기준으로 되돌린다. 효과 수치·공병증·부작용 등
   * 관리자가 손으로 고친 값은 건드리지 않는다('엑셀 반영'은 문서를 통째로 덮어쓴다).
   *
   * 계열이 빠지면 화면에 계열이 하나만 보이는 데서 그치지 않고, checkDeductions 의
   * 계열 수 판정이 어긋나 엉뚱한 삭감이 계속 뜬다. 실제로 그 문제를 겪어서 만든 버튼.
   */
  const handleRepair = async () => {
    const seedById = new Map(seedMedications.map((m) => [m.id, m]));
    const fixes: { med: Medication; next: Medication; reasons: string[] }[] = [];

    for (const m of medications) {
      const s = seedById.get(m.id);
      if (!s) continue; // 시드에 없는(직접 추가한) 약제는 건드리지 않는다
      const next = { ...m };
      const reasons: string[] = [];

      if (!m.ingredient && s.ingredient) {
        next.ingredient = s.ingredient;
        reasons.push('성분');
      }
      const cur = [...m.classes].sort().join('|');
      const want = [...s.classes].sort().join('|');
      if (cur !== want) {
        next.classes = [...s.classes];
        // 카테고리(단일제/2제/3제…)는 계열 수에서 파생되므로 함께 되돌린다.
        next.categoryId = s.categoryId;
        reasons.push(`계열 ${m.classes.length}→${s.classes.length}`);
      }
      if (reasons.length > 0) fixes.push({ med: m, next, reasons });
    }

    if (fixes.length === 0) {
      showFlash('점검 완료 — 고칠 약제가 없습니다.');
      return;
    }

    const classFixes = fixes.filter((f) => f.reasons.some((r) => r.startsWith('계열')));
    const sample = fixes
      .slice(0, 8)
      .map((f) => `  • ${f.med.name} — ${f.reasons.join(', ')}`)
      .join('\n');
    const ok = confirm(
      `약제 ${fixes.length}종을 고칩니다.\n` +
        `  계열 복구 ${classFixes.length}종 · 성분 채움 ${fixes.length - classFixes.length}종\n\n` +
        `${sample}${fixes.length > 8 ? `\n  … 외 ${fixes.length - 8}종` : ''}\n\n` +
        '계열·주성분·카테고리만 시드 기준으로 되돌립니다.\n' +
        '효과 수치·공병증·부작용 등 직접 고친 값은 그대로 둡니다.\n\n진행할까요?',
    );
    if (!ok) return;

    setRepairing(true);
    try {
      await ensureMaterialized('medications', medications, medsEmpty);
      await Promise.all(
        fixes.map(({ next }) => {
          const { id, ...rest } = next;
          return saveDoc('medications', id, rest as unknown as Record<string, unknown>);
        }),
      );
      showFlash(`복구 완료 — ${fixes.length}종 (계열 ${classFixes.length}종)`);
    } catch (e) {
      showFlash(`복구 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRepairing(false);
    }
  };

  /**
   * 카테고리 정리.
   *
   * Firestore 약제 데이터는 여러 세대의 시드를 거치며 옛 카테고리 id(cat_combo '복합제' 등)와
   * 계열 수에 안 맞는 배정이 섞여 있다. 그래서 '지금 어느 카테고리에 있는지'는 보지 않고
   * **계열 수 → 카테고리** 규칙(deriveCategoryId) 하나로 전부 다시 배정한다.
   *   - 3계열인데 '2제 복합제'에 있던 약제 → '3제 복합제'로 이동
   *   - 옛 '복합제'는 그렇게 비워진 뒤 문서째 삭제
   *   - 시드 제품과 이름은 같은데 계열이 다른 손추가 약제는 삭제 후보로 올려 확인받는다
   *
   * 건드리는 필드는 categoryId 뿐이다. 효과 수치·공병증·부작용 등은 그대로 둔다.
   */
  const handleTidyCategories = async () => {
    const plan = planCategoryTidy(medications, categories, seedMedications, seedMedCategories);
    const { catFixes, missingCategories, staleCategories, suspectMeds } = plan;

    if (
      catFixes.length === 0 &&
      missingCategories.length === 0 &&
      staleCategories.length === 0 &&
      suspectMeds.length === 0
    ) {
      showFlash('정리할 것이 없습니다 — 카테고리가 이미 계열 수와 맞습니다.');
      return;
    }

    const catName = (id: string) =>
      categories.find((c) => c.id === id)?.name ??
      seedMedCategories.find((c) => c.id === id)?.name ??
      id;

    const lines: string[] = [];
    if (catFixes.length > 0) {
      lines.push(`■ 구분 재배정 ${catFixes.length}종`);
      const byMove = new Map<string, number>();
      for (const f of catFixes) {
        const k = `${catName(f.from)} → ${catName(f.to)}`;
        byMove.set(k, (byMove.get(k) ?? 0) + 1);
      }
      for (const [k, n] of byMove) lines.push(`   ${k} : ${n}종`);
    }
    if (missingCategories.length > 0)
      lines.push(`■ 카테고리 생성 : ${missingCategories.map((c) => c.name).join(', ')}`);
    if (staleCategories.length > 0)
      lines.push(`■ 빈 카테고리 삭제 : ${staleCategories.map((c) => c.name).join(', ')}`);
    if (suspectMeds.length > 0) {
      lines.push(`■ 중복 의심 약제 삭제 ${suspectMeds.length}종 (시드와 이름은 같은데 계열이 다름)`);
      for (const s of suspectMeds.slice(0, 8))
        lines.push(`   ${s.med.name} (계열 ${s.med.classes.length}개) ↔ ${s.twin.name}`);
      if (suspectMeds.length > 8) lines.push(`   … 외 ${suspectMeds.length - 8}종`);
    }

    const ok = confirm(
      `${lines.join('\n')}\n\n` +
        '약제의 구분(카테고리)만 계열 수 기준으로 다시 배정합니다.\n' +
        '효과 수치·공병증·부작용 등 직접 고친 값은 그대로 둡니다.\n\n진행할까요?',
    );
    if (!ok) return;

    setTidying(true);
    try {
      await ensureMaterialized('medications', medications, medsEmpty);
      await ensureMaterialized('medCategories', categories, medCategoriesEmpty);
      await ensureMaterialized('drugClasses', drugClasses, drugClassesEmpty);

      // 이동 대상이 들어갈 카테고리를 먼저 만들어 둔다 (없는 구분으로 옮겨 사라지는 일 방지)
      for (const c of missingCategories) {
        const { id, ...rest } = c;
        await saveDoc('medCategories', id, rest as unknown as Record<string, unknown>);
      }
      await Promise.all(
        catFixes.map(({ med, to }) => {
          const { id, ...rest } = { ...med, categoryId: to };
          return saveDoc('medications', id, rest as unknown as Record<string, unknown>);
        }),
      );
      await Promise.all(suspectMeds.map(({ med }) => removeDoc('medications', med.id)));
      await Promise.all(staleCategories.map((c) => removeDoc('medCategories', c.id)));

      showFlash(
        `정리 완료 — 재배정 ${catFixes.length}종` +
          (suspectMeds.length > 0 ? ` · 삭제 ${suspectMeds.length}종` : '') +
          (staleCategories.length > 0 ? ` · 빈 구분 ${staleCategories.length}개 삭제` : ''),
      );
    } catch (e) {
      showFlash(`정리 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTidying(false);
    }
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
          onClick={() => void handleRepair()}
          disabled={repairing || seeding || importing || applying || medications.length === 0}
          title="계열·주성분이 비었거나 어긋난 약제만 시드 기준으로 되돌립니다 (다른 값은 유지)"
          className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          <Wrench className="h-3.5 w-3.5" />
          {repairing ? '복구 중…' : '계열·성분 점검·복구'}
        </button>
        <button
          type="button"
          onClick={() => void handleTidyCategories()}
          disabled={tidying || repairing || seeding || importing || applying || medications.length === 0}
          title="약제 구분(단일제·2제·메폴민 2제·3제)을 계열 수 기준으로 다시 배정하고, 비는 옛 카테고리를 지웁니다"
          className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <FolderTree className="h-3.5 w-3.5" />
          {tidying ? '정리 중…' : '카테고리 정리'}
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
        <strong className="text-orange-600">카테고리 정리</strong>: 약제 구분을 <strong>계열 수</strong>로 다시
        배정합니다 (1개=단일제, 2개=2제·메폴민 2제, 3개 이상=3제). 3계열 약제가 2제 복합제에 섞여 있거나 옛
        <strong> ‘복합제’</strong> 구분이 남아 있을 때 쓰세요. 구분만 고치고 효과 수치는 건드리지 않습니다.
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
