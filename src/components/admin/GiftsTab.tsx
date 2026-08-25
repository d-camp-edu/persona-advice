import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Download, CalendarRange } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { saveDoc, removeDoc } from '../../lib/firestoreApi';
import { uploadGifts } from '../../data/seedRunner';
import { giftProb } from '../../lib/giftWin';
import ImageUploader from '../common/ImageUploader';
import type { Gift, TargetCampaign } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function newGift(): Gift {
  return {
    id: `gift_${Date.now().toString(36)}`,
    name: '새 선물',
    imageUrl: '',
    probHospital: 0,
    probClinic: 0,
    campaignProbs: {},
    order: 99,
  };
}

const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

function GiftEditor({
  gift,
  campaigns,
  /** 이 선물을 뺀 나머지 선물들의 확률 합 (현재 보기 캠페인 기준) */
  otherHospital,
  otherClinic,
  viewCampaignId,
  onSave,
  onDelete,
}: {
  gift: Gift;
  campaigns: TargetCampaign[];
  otherHospital: number;
  otherClinic: number;
  viewCampaignId: string;
  onSave: (g: Gift) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Gift>(() => structuredClone(gift));
  const [saving, setSaving] = useState(false);
  const [addCampaignId, setAddCampaignId] = useState('');

  const set = <K extends keyof Gift>(k: K, v: Gift[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const overrides = draft.campaignProbs ?? {};
  const overrideIds = Object.keys(overrides);
  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name ?? '(삭제된 캠페인)';
  const campaignMonth = (id: string) => campaigns.find((c) => c.id === id)?.month ?? '';

  const setOverride = (campaignId: string, key: 'hospital' | 'clinic', value: number) =>
    setDraft((d) => {
      const next = { ...(d.campaignProbs ?? {}) };
      const cur = next[campaignId] ?? { hospital: 0, clinic: 0 };
      next[campaignId] = { ...cur, [key]: clampPct(value) };
      return { ...d, campaignProbs: next };
    });

  const addOverride = () => {
    if (!addCampaignId) return;
    setDraft((d) => {
      const next = { ...(d.campaignProbs ?? {}) };
      if (!next[addCampaignId]) {
        // 새 캠페인 행은 기본 확률을 출발값으로 채워준다.
        next[addCampaignId] = { hospital: d.probHospital, clinic: d.probClinic };
      }
      return { ...d, campaignProbs: next };
    });
    setAddCampaignId('');
  };

  const removeOverride = (campaignId: string) =>
    setDraft((d) => {
      const next = { ...(d.campaignProbs ?? {}) };
      delete next[campaignId];
      return { ...d, campaignProbs: next };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  // 현재 보기 캠페인 기준으로 draft가 기여하는 확률 → 꽝 % 계산
  const draftH = giftProb(draft, '병원', viewCampaignId || undefined);
  const draftC = giftProb(draft, '의원', viewCampaignId || undefined);
  const remH = 100 - otherHospital - draftH;
  const remC = 100 - otherClinic - draftC;
  const overH = remH < 0;
  const overC = remC < 0;

  const addableCampaigns = campaigns.filter((c) => !overrideIds.includes(c.id));

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
      <div className="mb-3">
        <ImageUploader
          value={draft.imageUrl}
          onChange={(url) => set('imageUrl', url)}
          storagePath={`gifts/${draft.id}`}
          label="선물 이미지"
          previewSize="md"
          maxDim={512}
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

      <p className="mb-1 text-xs font-semibold text-gray-600">기본 확률</p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">병원 확률 (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            className={`${inp} ${overH && !viewCampaignId ? 'border-red-400' : ''}`}
            value={draft.probHospital}
            onChange={(e) => set('probHospital', clampPct(+e.target.value))}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-500">의원 확률 (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            className={`${inp} ${overC && !viewCampaignId ? 'border-red-400' : ''}`}
            value={draft.probClinic}
            onChange={(e) => set('probClinic', clampPct(+e.target.value))}
          />
        </div>
      </div>

      {/* 캠페인(진행기간)별 확률 오버라이드 */}
      <div className="mb-3 rounded-lg border border-indigo-100 bg-white p-3">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <CalendarRange size={13} /> 캠페인별 확률
        </p>
        <p className="mb-2 text-[11px] leading-snug text-gray-400">
          타겟처 진행(캠페인)에 따라 이 선물의 확률을 다르게 줍니다. 여기에 없는 캠페인과 직접 입력
          로그인은 위 기본 확률을 씁니다.
        </p>

        {overrideIds.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {overrideIds.map((cid) => (
              <div key={cid} className="grid grid-cols-[1fr_4.5rem_4.5rem_auto] items-center gap-1.5">
                <span className="truncate text-xs text-gray-700" title={campaignName(cid)}>
                  {campaignName(cid)}
                  {campaignMonth(cid) && (
                    <span className="ml-1 text-[10px] text-gray-400">{campaignMonth(cid)}</span>
                  )}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  aria-label="병원 확률"
                  placeholder="병원"
                  className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-500"
                  value={overrides[cid].hospital}
                  onChange={(e) => setOverride(cid, 'hospital', +e.target.value)}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  aria-label="의원 확률"
                  placeholder="의원"
                  className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-indigo-500"
                  value={overrides[cid].clinic}
                  onChange={(e) => setOverride(cid, 'clinic', +e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeOverride(cid)}
                  aria-label="캠페인 확률 삭제"
                  className="rounded border border-red-200 p-1 text-red-400 hover:bg-red-50"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <p className="text-[10px] text-gray-400">좌: 캠페인 · 중: 병원 % · 우: 의원 %</p>
          </div>
        )}

        {campaigns.length === 0 ? (
          <p className="text-[11px] text-gray-400">
            등록된 캠페인이 없습니다. 관리자 '진행률' 탭에서 캠페인을 먼저 만드세요.
          </p>
        ) : (
          <div className="flex gap-1.5">
            <select
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-indigo-500"
              value={addCampaignId}
              onChange={(e) => setAddCampaignId(e.target.value)}
              disabled={addableCampaigns.length === 0}
            >
              <option value="">
                {addableCampaigns.length === 0 ? '모든 캠페인에 지정됨' : '캠페인 선택…'}
              </option>
              {addableCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.month})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addOverride}
              disabled={!addCampaignId}
              className="flex shrink-0 items-center gap-1 rounded border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
            >
              <Plus size={12} /> 추가
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex gap-4 rounded-lg bg-white px-3 py-2 text-xs">
        <span className={`font-medium ${overH ? 'text-red-500' : 'text-gray-600'}`}>
          병원 꽝: {Math.max(0, remH)}%{overH ? ' ⚠️ 초과!' : ''}
        </span>
        <span className={`font-medium ${overC ? 'text-red-500' : 'text-gray-600'}`}>
          의원 꽝: {Math.max(0, remC)}%{overC ? ' ⚠️ 초과!' : ''}
        </span>
        <span className="ml-auto text-gray-400">
          {viewCampaignId ? '선택 캠페인 기준' : '기본 확률 기준'}
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
  const campaigns = useDataStore((s) => s.targetCampaigns);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewCampaignId, setViewCampaignId] = useState('');
  const [flash, setFlash] = useState('');

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)),
    [campaigns],
  );

  const sorted = [...gifts].sort((a, b) => a.order - b.order);
  const view = viewCampaignId || undefined;
  const totalH = gifts.reduce((s, g) => s + giftProb(g, '병원', view), 0);
  const totalC = gifts.reduce((s, g) => s + giftProb(g, '의원', view), 0);
  const kwangH = Math.max(0, 100 - totalH);
  const kwangC = Math.max(0, 100 - totalC);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSave = async (g: Gift) => {
    const { id, ...rest } = g;
    // Firestore 는 undefined 를 거부한다 — 캠페인 확률이 없으면 빈 객체로 저장.
    const payload = { ...rest, campaignProbs: rest.campaignProbs ?? {} };
    await saveDoc('gifts', id, payload as unknown as Record<string, unknown>);
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

  const handleSeed = async () => {
    if (!confirm('기본 선물 목록을 등록하시겠습니까? (같은 id는 덮어씁니다)')) return;
    try {
      await uploadGifts();
      showFlash('기본 선물 등록됨');
    } catch {
      showFlash('등록 실패 (Firebase 미구성 여부 확인)');
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          새 선물
        </button>
        {gifts.length === 0 && (
          <button
            type="button"
            onClick={() => void handleSeed()}
            className="flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            <Download className="h-3.5 w-3.5" />
            기본 선물 불러오기
          </button>
        )}
        {sortedCampaigns.length > 0 && (
          <select
            className="ml-auto max-w-[14rem] rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
            value={viewCampaignId}
            onChange={(e) => setViewCampaignId(e.target.value)}
            title="어느 캠페인 기준으로 확률을 볼지 선택"
          >
            <option value="">기본 확률로 보기</option>
            {sortedCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.month})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 전체 확률 요약 */}
      <div className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs">
        <p className="mb-1.5 font-semibold text-gray-700">
          전체 확률 현황
          <span className="ml-1.5 font-normal text-gray-400">
            {viewCampaignId
              ? `— ${sortedCampaigns.find((c) => c.id === viewCampaignId)?.name ?? ''} 기준`
              : '— 기본 확률 기준'}
          </span>
        </p>
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
          {sorted.map((g) => {
            const gh = giftProb(g, '병원', view);
            const gc = giftProb(g, '의원', view);
            const isOverridden = !!(view && g.campaignProbs?.[view]);
            const overrideCount = Object.keys(g.campaignProbs ?? {}).length;
            return (
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
                        병원 {gh}% · 의원 {gc}%
                      </span>
                      {isOverridden && (
                        <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">
                          캠페인 확률
                        </span>
                      )}
                      {!view && overrideCount > 0 && (
                        <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          캠페인 {overrideCount}건
                        </span>
                      )}
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
                    campaigns={sortedCampaigns}
                    otherHospital={totalH - gh}
                    otherClinic={totalC - gc}
                    viewCampaignId={viewCampaignId}
                    onSave={handleSave}
                    onDelete={() => handleDelete(g.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
