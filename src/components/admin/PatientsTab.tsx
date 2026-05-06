import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { uploadPatients } from '../../data/seedRunner';
import type { Patient, PatientType, Gender, Adherence } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newPatient(): Patient {
  return {
    id: `p_${Date.now().toString(36)}`,
    name: '새 환자',
    age: 60,
    gender: 'M',
    weight: 70,
    bmi: 25,
    initialHba1c: 8.0,
    type: '재진',
    desc: '',
    comorbidities: [],
    adherence: '좋음',
    order: 99,
    lvef: 0,
    nyha: 0,
    bnp: 0,
    ntprobnp: 0,
    hfHospitalization: false,
    echoAbnormal: false,
    hfStandardTx: false,
    egfr: 0,
    uacr: 0,
    dipstick: false,
    ckdStandardTx: false,
    prevDrugs: [],
    prevTreatment: '',
    imageUrl: '',
  };
}

function PatientEditor({
  patient,
  comorbNames,
  onSave,
  onDelete,
}: {
  patient: Patient;
  comorbNames: string[];
  onSave: (p: Patient) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Patient>(() => structuredClone(patient));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Patient>(k: K, v: Patient[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const toggleComorb = (name: string) => {
    const cur = draft.comorbidities;
    set('comorbidities', cur.includes(name) ? cur.filter((c) => c !== name) : [...cur, name]);
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
      <div className="grid grid-cols-2 gap-x-3">
        {/* 기본 */}
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">이름</label>
          <input className={`${inp} mb-2`} value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">순서</label>
          <input type="number" className={`${inp} mb-2`} value={draft.order} onChange={(e) => set('order', +e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">나이</label>
          <input type="number" className={`${inp} mb-2`} value={draft.age} onChange={(e) => set('age', +e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">성별</label>
          <select className={`${inp} mb-2`} value={draft.gender} onChange={(e) => set('gender', e.target.value as Gender)}>
            <option value="M">남(M)</option>
            <option value="F">여(F)</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">체중(kg)</label>
          <input type="number" step="0.1" className={`${inp} mb-2`} value={draft.weight} onChange={(e) => set('weight', +e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">BMI</label>
          <input type="number" step="0.1" className={`${inp} mb-2`} value={draft.bmi} onChange={(e) => set('bmi', +e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">초기 HbA1c</label>
          <input type="number" step="0.1" className={`${inp} mb-2`} value={draft.initialHba1c} onChange={(e) => set('initialHba1c', +e.target.value)} />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">내원 유형</label>
          <select className={`${inp} mb-2`} value={draft.type} onChange={(e) => set('type', e.target.value as PatientType)}>
            <option value="초진">초진</option>
            <option value="재진">재진</option>
            <option value="리핏">리핏</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">순응도</label>
          <select className={`${inp} mb-2`} value={draft.adherence} onChange={(e) => set('adherence', e.target.value as Adherence)}>
            <option value="좋음">좋음</option>
            <option value="나쁨">나쁨</option>
          </select>
        </div>
      </div>

      <label className="mb-0.5 block text-xs text-gray-500">설명</label>
      <textarea rows={2} className={`${inp} mb-2 resize-none`} value={draft.desc} onChange={(e) => set('desc', e.target.value)} />

      <label className="mb-0.5 block text-xs text-gray-500">이미지 URL</label>
      <input className={`${inp} mb-3`} value={draft.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://..." />

      {/* 심장 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">심부전 지표</p>
      <div className="mb-3 grid grid-cols-2 gap-x-3">
        {(
          [
            { k: 'lvef', label: 'LVEF (%)' },
            { k: 'nyha', label: 'NYHA' },
            { k: 'bnp', label: 'BNP' },
            { k: 'ntprobnp', label: 'NT-proBNP' },
          ] as { k: keyof Patient; label: string }[]
        ).map(({ k, label }) => (
          <div key={k}>
            <label className="mb-0.5 block text-xs text-gray-500">{label}</label>
            <input type="number" step="0.1" className={`${inp} mb-1`} value={draft[k] as number} onChange={(e) => set(k, +e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {(
          [
            { k: 'hfHospitalization', label: '입원력' },
            { k: 'echoAbnormal', label: '심초음파 이상' },
            { k: 'hfStandardTx', label: '표준 치료 중' },
          ] as { k: keyof Patient; label: string }[]
        ).map(({ k, label }) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={draft[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="h-3.5 w-3.5" />
            {label}
          </label>
        ))}
      </div>

      {/* 신장 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">신장 지표</p>
      <div className="mb-3 grid grid-cols-2 gap-x-3">
        {(
          [
            { k: 'egfr', label: 'eGFR' },
            { k: 'uacr', label: 'UACR' },
          ] as { k: keyof Patient; label: string }[]
        ).map(({ k, label }) => (
          <div key={k}>
            <label className="mb-0.5 block text-xs text-gray-500">{label}</label>
            <input type="number" step="0.1" className={`${inp} mb-1`} value={draft[k] as number} onChange={(e) => set(k, +e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        {(
          [
            { k: 'dipstick', label: 'Dipstick 양성' },
            { k: 'ckdStandardTx', label: 'CKD 표준 치료 중' },
          ] as { k: keyof Patient; label: string }[]
        ).map(({ k, label }) => (
          <label key={k} className="flex items-center gap-1">
            <input type="checkbox" checked={draft[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="h-3.5 w-3.5" />
            {label}
          </label>
        ))}
      </div>

      {/* 이전 복용약 */}
      <label className="mb-0.5 block text-xs text-gray-500">이전 복용약 (쉼표 구분)</label>
      <input
        className={`${inp} mb-2`}
        value={draft.prevDrugs.join(', ')}
        onChange={(e) => set('prevDrugs', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
      />
      <label className="mb-0.5 block text-xs text-gray-500">이전 치료 요약</label>
      <input className={`${inp} mb-3`} value={draft.prevTreatment} onChange={(e) => set('prevTreatment', e.target.value)} />

      {/* 공병증 */}
      <p className="mb-1 text-xs font-semibold text-gray-600">공병증</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {comorbNames.map((name) => (
          <label key={name} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={draft.comorbidities.includes(name)}
              onChange={() => toggleComorb(name)}
              className="h-3.5 w-3.5"
            />
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
            if (confirm('이 환자를 삭제하시겠습니까?')) void onDelete();
          }}
          className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function PatientsTab() {
  const patients = useDataStore((s) => s.patients);
  const settings = useDataStore((s) => s.settings);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [flash, setFlash] = useState('');

  const comorbNames = settings.comorbidities.map((c) => c.name);
  const sorted = [...patients].sort((a, b) => a.order - b.order);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async (p: Patient) => {
    const { id, ...rest } = p;
    await saveDoc('patients', id, rest as unknown as Record<string, unknown>);
    showFlash('저장됨');
    setExpanded(null);
  };

  const handleDelete = async (id: string) => {
    await removeDoc('patients', id);
    setExpanded(null);
  };

  const handleAdd = async () => {
    const p = newPatient();
    const { id, ...rest } = p;
    await saveDoc('patients', id, rest as unknown as Record<string, unknown>);
    setExpanded(p.id);
  };

  const handleSeedReset = async () => {
    if (!confirm('환자 데이터를 기본 20명으로 초기화하시겠습니까?')) return;
    setSeeding(true);
    try {
      await uploadPatients();
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
          새 환자
        </button>
        <button
          type="button"
          onClick={() => void handleSeedReset()}
          disabled={seeding}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {seeding ? '초기화 중…' : '기본 초기화 (20명)'}
        </button>
      </div>
      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        {sorted.map((p) => (
          <div key={p.id}>
            <button
              type="button"
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
              className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div>
                <span className="text-sm font-medium text-gray-900">{p.name}</span>
                <span className="ml-2 text-xs text-gray-400">{p.type} · HbA1c {p.initialHba1c}%</span>
              </div>
              {expanded === p.id ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {expanded === p.id && (
              <PatientEditor
                patient={p}
                comorbNames={comorbNames}
                onSave={handleSave}
                onDelete={() => handleDelete(p.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
