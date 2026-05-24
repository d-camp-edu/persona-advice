import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import ImageUploader from '../common/ImageUploader';
import type { Gift } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newGift(): Gift {
  return {
    id: `gift_${Date.now().toString(36)}`,
    name: '새 선물',
    imageUrl: '',
    probHospital: 0,
    probClinic: 0,
    order: 99,
  };
}

function GiftEditor({
  gift,
  totalHospital,
  totalClinic,
  onSave,
  onDelete,
}: {
  gift: Gift;
  totalHospital: number;
  totalClinic: number;
  onSave: (g: Gift) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Gift>(() => structuredClone(gift));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Gift>(k: K, v: Gift[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  // remaining after all OTHER gifts + this draft
  const otherH = totalHospital - gift.probHospital;
  const otherC = totalClinic - gift.probClinic;
  const remH = 100 - otherH - draft.probHospital;
  const remC = 100 - otherC - draft.probClinic;
  const overH = remH < 0;
  const overC = remC < 0;

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
      <div className="mb-3">
        <ImageUploader
          value={draft.imageUrl}
          onChange={(url) => set('imageUrl', url)}
          storagePath={`gifts/${draft.id}`}
          label="선물 이미지"
          previewSize="md"
        />
      </div>

      <div className="mb-2">
        <label className="mb-0.5 block text-xs text-gray-500">선물 이름</label>
        <input
          className={`${inp} mb-2`}
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">병원 확률 (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            className={`${inp} ${overH ? 'border-red-400' : ''}`}
            value={draft.probHospital}
            onChange={(e) => set('probHospital', Math.max(0, Math.min(100, +e.target.value)))}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">의원 확률 (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            className={`${inp} ${overC ? 'border-red-400' : ''}`}
            value={draft.probClinic}
            onChange={(e) => set('probClinic', Math.max(0, Math.min(100, +e.target.value)))}
          />
        </div>
      </div>

      <div className="mb-3 flex gap-4 rounded-lg bg-white px-3 py-2 text-xs">
        <span className={`font-medium ${overH ? 'text-red-500' : 'text-gray-600'}`}>
          병원 꽝: {Math.max(0, remH)}%{overH ? ' ⚠️ 초과!' : ''}
        </span>
        <span className={`font-medium ${overC ? 'text-red-500' : 'text-gray-600'}`}>
          의원 꽝: {Math.max(0, remC)}%{overC ? ' ⚠️ 초과!' : ''}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || overH || overC}
          className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('이 선물을 삭제하시겠습니까?')) void onDelete();
          }}
          className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function GiftsTab() {
  const gifts = useDataStore((s) => s.gifts);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash] = useState('');

  const sorted = [...gifts].sort((a, b) => a.order - b.order);
  const totalH = gifts.reduce((s, g) => s + g.probHospital, 0);
  const totalC = gifts.reduce((s, g) => s + g.probClinic, 0);
  const kwangH = Math.max(0, 100 - totalH);
  const kwangC = Math.max(0, 100 - totalC);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async (g: Gift) => {
    const { id, ...rest } = g;
    await saveDoc('gifts', id, rest as unknown as Record<string, unknown>);
    showFlash('저장됨');
    setExpanded(null);
  };

  const handleDelete = async (id: string) => {
    await removeDoc('gifts', id);
    setExpanded(null);
  };

  const handleAdd = async () => {
    const g = newGift();
    const { id, ...rest } = g;
    await saveDoc('gifts', id, rest as unknown as Record<string, unknown>);
    setExpanded(g.id);
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
          새 선물
        </button>
      </div>

      {/* 전체 확률 요약 */}
      <div className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs">
        <p className="mb-1.5 font-semibold text-gray-700">전체 확률 현황</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-gray-500">병원</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-gray-100">
                <div
                  className={`h-2 rounded-full transition-all ${totalH > 100 ? 'bg-red-400' : 'bg-indigo-400'}`}
                  style={{ width: `${Math.min(100, totalH)}%` }}
                />
              </div>
              <span className={totalH > 100 ? 'font-bold text-red-500' : 'text-gray-600'}>
                선물 {totalH}% / 꽝 {kwangH}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-gray-500">의원</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-gray-100">
                <div
                  className={`h-2 rounded-full transition-all ${totalC > 100 ? 'bg-red-400' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.min(100, totalC)}%` }}
                />
              </div>
              <span className={totalC > 100 ? 'font-bold text-red-500' : 'text-gray-600'}>
                선물 {totalC}% / 꽝 {kwangC}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      {sorted.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">등록된 선물이 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          {sorted.map((g) => (
            <div key={g.id}>
              <button
                type="button"
                onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-2.5">
                  {g.imageUrl ? (
                    <img
                      src={g.imageUrl}
                      className="h-8 w-8 rounded-lg object-cover border border-gray-100"
                      alt=""
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 border border-amber-100">
                      <span className="text-base">🎁</span>
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-gray-900">{g.name}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      병원 {g.probHospital}% · 의원 {g.probClinic}%
                    </span>
                  </div>
                </div>
                {expanded === g.id ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {expanded === g.id && (
                <GiftEditor
                  gift={g}
                  totalHospital={totalH}
                  totalClinic={totalC}
                  onSave={handleSave}
                  onDelete={() => handleDelete(g.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
