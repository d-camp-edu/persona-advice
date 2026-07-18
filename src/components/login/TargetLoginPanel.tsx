import { useMemo, useState } from 'react';
import { Search, Loader2, CheckCircle2, ChevronRight, Building2, Stethoscope, Package, History } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useSessionStore } from '../../store/useSessionStore';
import { loadTargetsByEmp, loadCompletionsByEmp } from '../../lib/targetsRepo';
import type { Target, TargetCampaign } from '../../types';

const LAST_EMPNO_KEY = 'persona_rx_last_empno';
function loadLastEmpNo(): string {
  try {
    return localStorage.getItem(LAST_EMPNO_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveLastEmpNo(no: string): void {
  try {
    localStorage.setItem(LAST_EMPNO_KEY, no);
  } catch {
    /* ignore */
  }
}

export default function TargetLoginPanel() {
  const campaigns = useDataStore((s) => s.targetCampaigns);
  const products = useDataStore((s) => s.products);
  const loginWithTarget = useSessionStore((s) => s.loginWithTarget);

  const activeProducts = useMemo(
    () => [...products].filter((p) => p.active).sort((a, b) => a.order - b.order),
    [products],
  );
  const hasProducts = activeProducts.length > 0;

  const activeCampaigns = useMemo(() => campaigns.filter((c) => c.active), [campaigns]);
  const campaignById = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);

  const [productId, setProductId] = useState('');
  const [empNo, setEmpNo] = useState('');
  const [lastEmpNo] = useState(loadLastEmpNo);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const selectedProductName = activeProducts.find((p) => p.id === productId)?.name ?? '';
  const empName = targets.find((t) => t.empName)?.empName ?? '';
  const total = targets.length;
  const done = targets.filter((t) => doneIds.has(t.id)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // 품목이 있으면 그 품목의 활성 캠페인, 없으면 전체 활성 캠페인
  const scopedCampaignIds = useMemo(() => {
    if (hasProducts) {
      if (!productId) return [];
      return activeCampaigns.filter((c) => c.productId === productId).map((c) => c.id);
    }
    return activeCampaigns.map((c) => c.id);
  }, [hasProducts, productId, activeCampaigns]);

  const canSearch = (!hasProducts || !!productId) && empNo.trim().length > 0 && !loading;

  const resetResults = () => {
    setSearched(false);
    setTargets([]);
    setDoneIds(new Set());
    setError('');
  };

  const handleSearch = async () => {
    const no = empNo.trim();
    if (!no) return;
    if (hasProducts && !productId) {
      setError('먼저 품목을 선택하세요.');
      return;
    }
    saveLastEmpNo(no);
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const ids = scopedCampaignIds;
      const [ts, comps] = await Promise.all([
        loadTargetsByEmp(no, ids.length > 0 ? ids : undefined),
        loadCompletionsByEmp(no, ids.length > 0 ? ids : undefined),
      ]);
      // 품목이 있는데 매칭 캠페인이 없으면(빈 ids) 잘못된 전체조회를 막는다.
      if (hasProducts && ids.length === 0) {
        setTargets([]);
        setDoneIds(new Set());
      } else {
        setTargets(ts);
        setDoneIds(new Set(comps.map((c) => c.targetId)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '검색 실패');
      setTargets([]);
      setDoneIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const handlePick = (t: Target) => {
    const campaign: TargetCampaign | undefined = campaignById.get(t.campaignId);
    if (!campaign) {
      setError('연결된 캠페인을 찾을 수 없습니다.');
      return;
    }
    const productName =
      selectedProductName ||
      products.find((p) => p.id === campaign.productId)?.name ||
      '';
    loginWithTarget(t, campaign, productName);
  };

  return (
    <div>
      {activeCampaigns.length === 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          진행 중인 캠페인이 없습니다. 관리자가 품목·타겟처·진행기간을 등록하면 검색됩니다.
        </p>
      )}

      {/* 1단계: 품목 선택 */}
      {hasProducts && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            <span className="mr-1 inline-flex items-center gap-1">
              <Package size={12} /> 품목 선택
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {activeProducts.map((p) => {
              const on = productId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProductId(p.id);
                    resetResults();
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2단계: 사번 입력 */}
      <label className="mb-1 block text-xs font-medium text-gray-600">담당자 사번</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={empNo}
          onChange={(e) => setEmpNo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canSearch) void handleSearch();
            }
          }}
          placeholder={hasProducts && !productId ? '먼저 품목을 선택하세요' : '예: 12345'}
          disabled={hasProducts && !productId}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50 disabled:text-gray-400"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={!canSearch}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          검색
        </button>
      </div>

      {lastEmpNo && lastEmpNo !== empNo.trim() && (
        <button
          type="button"
          onClick={() => setEmpNo(lastEmpNo)}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          <History size={13} />
          이전 사번 {lastEmpNo} 입력
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {searched && !loading && targets.length === 0 && !error && (
        <p className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-center text-sm text-gray-400">
          {selectedProductName ? `'${selectedProductName}' ` : ''}해당 사번에 배정된 타겟처가 없습니다.
        </p>
      )}

      {targets.length > 0 && (
        <div className="mt-4">
          {/* 담당자 진행률 */}
          <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-800">
                {empName ? `${empName} 님` : `사번 ${empNo}`}
                {selectedProductName && (
                  <span className="ml-1.5 text-xs font-normal text-indigo-500">· {selectedProductName}</span>
                )}
              </span>
              <span className="text-xs text-gray-500">
                완료 <strong className="text-indigo-600">{done}</strong> / 전체 {total} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* 타겟처 목록 */}
          <ul className="flex flex-col gap-2">
            {targets.map((t) => {
              const isDone = doneIds.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(t)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                      isDone
                        ? 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-300'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        t.institutionType === '병원' ? 'bg-indigo-50 text-indigo-500' : 'bg-teal-50 text-teal-500'
                      }`}
                    >
                      {t.institutionType === '병원' ? <Building2 size={17} /> : <Stethoscope size={17} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-gray-900">{t.name}</span>
                        {t.drName && <span className="shrink-0 text-xs text-gray-500">{t.drName}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-gray-400">
                        {[t.division, t.team].filter(Boolean).join(' · ')}
                        {t.code ? ` · ${t.code}` : ''}
                      </span>
                    </span>
                    {isDone ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 size={14} />
                        완료
                      </span>
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-indigo-400" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-gray-400">
            완료한 타겟처도 다시 선택해 진행할 수 있습니다. (완료 여부는 서베이 완료 시 갱신됩니다)
          </p>
        </div>
      )}
    </div>
  );
}
