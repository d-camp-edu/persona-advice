import { useState } from 'react';
import { Plus, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { batchUploadCollection } from '../../lib/firestoreApi';
import type { PatientMetricDef } from '../../types';
import { seedPatientMetricDefs } from '../../data/seed';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

const DIRECTION_LABELS: Record<PatientMetricDef['direction'], string> = {
  decrease_good: '감소=개선 (HbA1c, 체중 등)',
  increase_good: '증가=개선 (LVEF, eGFR 등)',
};

function newDef(order: number): PatientMetricDef {
  return {
    id: `custom_${Date.now()}`,
    label: '',
    unit: '',
    direction: 'decrease_good',
    isBuiltIn: false,
    enabled: true,
    order,
  };
}

export default function PatientProfileTab() {
  const metricDefs = useDataStore((s) => s.patientMetricDefs);
  const sorted = [...metricDefs].sort((a, b) => a.order - b.order);

  const [flash, setFlash] = useState('');
  const [saving, setSaving] = useState(false);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const saveDef = async (def: PatientMetricDef) => {
    setSaving(true);
    try {
      const { id, ...rest } = def;
      await saveDoc('patientMetricDefs', id, rest as unknown as Record<string, unknown>);
      showFlash('저장됨');
    } catch {
      showFlash('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (def: PatientMetricDef) => {
    await saveDef({ ...def, enabled: !def.enabled });
  };

  const handleDelete = async (def: PatientMetricDef) => {
    if (def.isBuiltIn) {
      showFlash('기본 지표는 삭제할 수 없습니다. 비활성화만 가능합니다.');
      return;
    }
    if (!confirm(`"${def.label}" 지표를 삭제하시겠습니까?`)) return;
    setSaving(true);
    try {
      await removeDoc('patientMetricDefs', def.id);
      showFlash('삭제됨');
    } catch {
      showFlash('삭제 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const maxOrder = sorted.length > 0 ? Math.max(...sorted.map((d) => d.order)) : 0;
    const draft = newDef(maxOrder + 1);
    await saveDef(draft);
  };

  const handleReset = async () => {
    if (!confirm('기본 지표로 초기화하시겠습니까? 커스텀 지표는 유지됩니다.')) return;
    setSaving(true);
    try {
      await batchUploadCollection('patientMetricDefs', seedPatientMetricDefs);
      showFlash('초기화됨');
    } catch {
      showFlash('초기화 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 rounded-lg bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
        환자 내원 시 검사결과 지표를 관리합니다. 기본 지표(기본값)는 비활성화만 가능하며,
        커스텀 지표는 추가·수정·삭제가 가능합니다.
        약제 처방 시 커스텀 지표 효과도 결과에 반영됩니다.
      </div>

      <div className="space-y-2 mb-4">
        {sorted.map((def) => (
          <MetricDefRow
            key={def.id}
            def={def}
            onSave={saveDef}
            onDelete={handleDelete}
            onToggle={toggleEnabled}
            disabled={saving}
          />
        ))}
        {sorted.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">등록된 지표가 없습니다.</p>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={15} />
          커스텀 지표 추가
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          기본 초기화
        </button>
      </div>

      {flash && <p className="text-center text-sm font-medium text-indigo-600">{flash}</p>}
    </div>
  );
}

function MetricDefRow({
  def,
  onSave,
  onDelete,
  onToggle,
  disabled,
}: {
  def: PatientMetricDef;
  onSave: (d: PatientMetricDef) => Promise<void>;
  onDelete: (d: PatientMetricDef) => Promise<void>;
  onToggle: (d: PatientMetricDef) => Promise<void>;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<PatientMetricDef>({ ...def });
  const [editing, setEditing] = useState(false);
  const dirty =
    draft.label !== def.label ||
    draft.unit !== def.unit ||
    draft.direction !== def.direction ||
    draft.order !== def.order;

  return (
    <div className={`rounded-lg border bg-white p-3 shadow-sm ${!def.enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="text-gray-300 flex-shrink-0" />

        {editing ? (
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">지표명</label>
              <input
                className={inp}
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="예: 혈압"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">단위</label>
              <input
                className={inp}
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                placeholder="예: mmHg"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-0.5 block">개선 방향</label>
              <select
                className={inp}
                value={draft.direction}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    direction: e.target.value as PatientMetricDef['direction'],
                  }))
                }
              >
                {Object.entries(DIRECTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">순서</label>
              <input
                type="number"
                className={inp}
                value={draft.order}
                onChange={(e) => setDraft((d) => ({ ...d, order: +e.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-800">{def.label || '(미입력)'}</span>
              {def.isBuiltIn && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                  기본
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              {def.unit && `단위: ${def.unit}`}
              {def.unit && ' · '}
              {DIRECTION_LABELS[def.direction]}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {editing && dirty && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onSave(draft).then(() => setEditing(false))}
              className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              저장
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (editing) setDraft({ ...def });
              setEditing((v) => !v);
            }}
            className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          >
            {editing ? '취소' : '편집'}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void onToggle(def)}
            title={def.enabled ? '비활성화' : '활성화'}
            className="rounded border border-gray-200 p-1 text-gray-400 hover:bg-gray-50"
          >
            {def.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          {!def.isBuiltIn && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onDelete(def)}
              className="rounded border border-red-100 p-1 text-red-400 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
