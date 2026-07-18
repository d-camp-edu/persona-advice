import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, FileUp, RefreshCw, Download, CalendarRange, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import {
  saveCampaign,
  deleteCampaign,
  uploadTargets,
  deleteTargetsByCampaign,
  loadAllTargets,
  loadAllCompletions,
  saveProduct,
  deleteProduct,
} from '../../lib/targetsRepo';
import { parseTargetsXlsx } from '../../lib/targetExcelImport';
import { downloadWorkbook } from '../../lib/excel';
import type { Product, Target, TargetCampaign, TargetCompletion } from '../../types';

const inp =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function newCampaign(): TargetCampaign {
  return {
    id: `camp_${Date.now().toString(36)}`,
    name: '',
    month: currentMonth(),
    startDate: '',
    endDate: '',
    active: true,
    createdAt: new Date().toISOString(),
  };
}

interface TeamStat {
  division: string;
  team: string;
  total: number;
  done: number;
}
interface RepStat {
  empNo: string;
  empName: string;
  division: string;
  team: string;
  total: number;
  done: number;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs text-gray-600">
        {done}/{total} ({pct}%)
      </span>
    </div>
  );
}

export default function ProgressTab() {
  const campaigns = useDataStore((s) => s.targetCampaigns);
  const products = useDataStore((s) => s.products);
  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)),
    [campaigns],
  );
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.order - b.order),
    [products],
  );
  const productName = (id?: string) => products.find((p) => p.id === id)?.name ?? '';

  const [flash, setFlash] = useState('');
  const showFlash = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(''), 3000);
  };

  // ── 품목 관리 ─────────────────────────────────────────────────────────
  const [newProductName, setNewProductName] = useState('');
  const handleAddProduct = async () => {
    const name = newProductName.trim();
    if (!name) return;
    const maxOrder = products.reduce((m, p) => Math.max(m, p.order), 0);
    try {
      await saveProduct({ id: `prod_${Date.now().toString(36)}`, name, order: maxOrder + 1, active: true });
      setNewProductName('');
      showFlash('품목 추가됨');
    } catch (e) {
      showFlash(`실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const handleToggleProduct = async (p: Product) => {
    try {
      await saveProduct({ ...p, active: !p.active });
    } catch (e) {
      showFlash(`실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const handleDeleteProduct = async (p: Product) => {
    if (!confirm(`품목 '${p.name}'을 삭제하시겠습니까?`)) return;
    try {
      await deleteProduct(p.id);
      showFlash('삭제됨');
    } catch (e) {
      showFlash(`실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ── 캠페인 폼 ─────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<TargetCampaign>(newCampaign);
  const [savingCamp, setSavingCamp] = useState(false);
  const setC = <K extends keyof TargetCampaign>(k: K, v: TargetCampaign[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSaveCampaign = async () => {
    if (!draft.name.trim() || !draft.month) {
      showFlash('캠페인명과 월(月)을 입력하세요.');
      return;
    }
    setSavingCamp(true);
    try {
      await saveCampaign({ ...draft, name: draft.name.trim() });
      showFlash('캠페인 저장됨');
      setDraft(newCampaign());
    } catch (e) {
      showFlash(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingCamp(false);
    }
  };

  const handleToggleActive = async (c: TargetCampaign) => {
    try {
      await saveCampaign({ ...c, active: !c.active });
    } catch (e) {
      showFlash(`변경 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDeleteCampaign = async (c: TargetCampaign) => {
    if (!confirm(`'${c.name}' 캠페인을 삭제하시겠습니까?\n(타겟처 데이터는 별도로 남습니다)`)) return;
    try {
      await deleteCampaign(c.id);
      showFlash('삭제됨');
    } catch (e) {
      showFlash(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ── 엑셀 업로드 ───────────────────────────────────────────────────────
  const [uploadCampaignId, setUploadCampaignId] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uploadCampaignId && sortedCampaigns.length > 0) {
      setUploadCampaignId(sortedCampaigns[0].id);
    }
  }, [sortedCampaigns, uploadCampaignId]);

  const handleUpload = async (file: File) => {
    if (!uploadCampaignId) {
      showFlash('먼저 캠페인을 선택(또는 생성)하세요.');
      return;
    }
    setImporting(true);
    try {
      const { format, targets } = await parseTargetsXlsx(file, uploadCampaignId);
      if (replaceExisting) await deleteTargetsByCampaign(uploadCampaignId);
      await uploadTargets(targets);
      showFlash(`${format} 타겟처 ${targets.length}건 업로드됨`);
      void loadDashboard();
    } catch (e) {
      showFlash(`업로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── 대시보드 ──────────────────────────────────────────────────────────
  const [month, setMonth] = useState<string>('all');
  const [dashProductId, setDashProductId] = useState<string>('all');
  const [dashCampaignId, setDashCampaignId] = useState<string>('all');
  const [targets, setTargets] = useState<Target[]>([]);
  const [completions, setCompletions] = useState<TargetCompletion[]>([]);
  const [loadingDash, setLoadingDash] = useState(false);
  const [showReps, setShowReps] = useState(false);

  const loadDashboard = async () => {
    setLoadingDash(true);
    try {
      const [ts, cs] = await Promise.all([loadAllTargets(), loadAllCompletions()]);
      setTargets(ts);
      setCompletions(cs);
    } catch (e) {
      showFlash(`대시보드 로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthOptions = useMemo(() => {
    const set = new Set(campaigns.map((c) => c.month).filter(Boolean));
    return [...set].sort((a, b) => (a < b ? 1 : -1));
  }, [campaigns]);

  // 선택 월·품목에 해당하는 캠페인 목록 (캠페인 드롭다운·요약의 풀)
  const scopedCampaigns = useMemo(
    () =>
      sortedCampaigns
        .filter((c) => month === 'all' || c.month === month)
        .filter((c) => dashProductId === 'all' || c.productId === dashProductId),
    [sortedCampaigns, month, dashProductId],
  );

  // 실제 집계 대상 캠페인 id 집합: 특정 캠페인을 고르면 그것만, 아니면 위 풀 전체
  const scopedCampaignIds = useMemo(() => {
    if (dashCampaignId !== 'all') return new Set([dashCampaignId]);
    return new Set(scopedCampaigns.map((c) => c.id));
  }, [scopedCampaigns, dashCampaignId]);

  // 캠페인별 진행률 요약 (월·품목 필터 안의 각 캠페인)
  const campaignStats = useMemo(() => {
    return scopedCampaigns.map((c) => {
      const ct = targets.filter((t) => t.campaignId === c.id);
      const doneSet = new Set(
        completions.filter((x) => x.campaignId === c.id).map((x) => x.targetId),
      );
      const total = ct.length;
      const done = ct.filter((t) => doneSet.has(t.id)).length;
      return { campaign: c, total, done };
    });
  }, [scopedCampaigns, targets, completions]);

  // 월·품목 필터가 바뀌어 선택 캠페인이 범위를 벗어나면 '전체'로 되돌린다.
  useEffect(() => {
    if (dashCampaignId !== 'all' && !scopedCampaigns.some((c) => c.id === dashCampaignId)) {
      setDashCampaignId('all');
    }
  }, [scopedCampaigns, dashCampaignId]);

  const { teamStats, repStats, overall } = useMemo(() => {
    const scopedTargets = targets.filter((t) => scopedCampaignIds.has(t.campaignId));
    const doneSet = new Set(
      completions.filter((c) => scopedCampaignIds.has(c.campaignId)).map((c) => c.targetId),
    );

    const teamMap = new Map<string, TeamStat>();
    const repMap = new Map<string, RepStat>();
    for (const t of scopedTargets) {
      const division = t.division || '(미지정 사업부)';
      const team = t.team || '(미지정 팀)';
      const isDone = doneSet.has(t.id);

      const teamKey = `${division} ${team}`;
      const ts = teamMap.get(teamKey) ?? { division, team, total: 0, done: 0 };
      ts.total += 1;
      if (isDone) ts.done += 1;
      teamMap.set(teamKey, ts);

      const repKey = t.empNo || `${t.empName}`;
      const rs =
        repMap.get(repKey) ??
        { empNo: t.empNo, empName: t.empName, division, team, total: 0, done: 0 };
      rs.total += 1;
      if (isDone) rs.done += 1;
      repMap.set(repKey, rs);
    }

    const teamStats = [...teamMap.values()].sort(
      (a, b) => a.division.localeCompare(b.division, 'ko') || a.team.localeCompare(b.team, 'ko'),
    );
    const repStats = [...repMap.values()].sort(
      (a, b) =>
        a.division.localeCompare(b.division, 'ko') ||
        a.team.localeCompare(b.team, 'ko') ||
        a.empName.localeCompare(b.empName, 'ko'),
    );
    const total = scopedTargets.length;
    const done = scopedTargets.filter((t) => doneSet.has(t.id)).length;
    return { teamStats, repStats, overall: { total, done } };
  }, [targets, completions, scopedCampaignIds]);

  // 사업부별 그룹 (팀 목록)
  const byDivision = useMemo(() => {
    const map = new Map<string, TeamStat[]>();
    for (const t of teamStats) {
      if (!map.has(t.division)) map.set(t.division, []);
      map.get(t.division)!.push(t);
    }
    return [...map.entries()];
  }, [teamStats]);

  const handleExport = () => {
    const monthLabel = month === 'all' ? '전체' : month;
    downloadWorkbook(`진행률_${monthLabel}.xls`, [
      {
        name: '팀별',
        headers: ['사업부', '팀', '전체', '완료', '진행률(%)'],
        rows: teamStats.map((t) => [
          t.division,
          t.team,
          t.total,
          t.done,
          t.total > 0 ? Math.round((t.done / t.total) * 100) : 0,
        ]),
      },
      {
        name: '담당자별',
        headers: ['사번', '담당자', '사업부', '팀', '전체', '완료', '진행률(%)'],
        rows: repStats.map((r) => [
          r.empNo,
          r.empName,
          r.division,
          r.team,
          r.total,
          r.done,
          r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
        ]),
      },
    ]);
  };

  return (
    <div className="space-y-5">
      {flash && (
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">{flash}</p>
      )}

      {/* ── 품목 관리 ── */}
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Package size={15} /> 품목 관리
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          자사 제품(품목)입니다. 담당자는 로그인 시 <strong>품목을 먼저 선택</strong>한 뒤 사번을 입력합니다.
          캠페인에 품목을 지정하면 해당 품목 담당자에게만 노출됩니다.
        </p>
        <div className="mb-3 flex gap-2">
          <input
            className={inp}
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddProduct();
              }
            }}
            placeholder="예: 자디앙, 트라젠타…"
          />
          <button
            type="button"
            onClick={() => void handleAddProduct()}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={14} /> 추가
          </button>
        </div>
        {sortedProducts.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-xs text-gray-400">
            등록된 품목이 없습니다.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedProducts.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  p.active ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-400'
                }`}
              >
                <button type="button" onClick={() => void handleToggleProduct(p)} title="활성/비활성 전환">
                  {p.name}
                  {!p.active && ' (비활성)'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteProduct(p)}
                  aria-label="삭제"
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 진행기간(캠페인) 관리 ── */}
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <CalendarRange size={15} /> 진행기간(캠페인) 관리
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          타겟처 배포 단위입니다. <strong>월(月)</strong>은 대시보드 월별 집계 기준,{' '}
          <strong>활성</strong>이면 로그인 화면 사번 검색에 노출됩니다.
        </p>

        {/* 새 캠페인 폼 */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="col-span-2">
            <label className="mb-0.5 block text-xs text-gray-500">캠페인명</label>
            <input
              className={inp}
              value={draft.name}
              onChange={(e) => setC('name', e.target.value)}
              placeholder="예: 2026년 7월 당뇨 디테일"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-0.5 block text-xs text-gray-500">품목</label>
            <select
              className={inp}
              value={draft.productId ?? ''}
              onChange={(e) => setC('productId', e.target.value || undefined)}
            >
              <option value="">품목 무관(전체)</option>
              {sortedProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">월 (집계 기준)</label>
            <input type="month" className={inp} value={draft.month} onChange={(e) => setC('month', e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 pb-1.5 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setC('active', e.target.checked)}
                className="h-4 w-4"
              />
              활성(로그인 노출)
            </label>
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">진행 시작일</label>
            <input type="date" className={inp} value={draft.startDate} onChange={(e) => setC('startDate', e.target.value)} />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-gray-500">진행 종료일</label>
            <input type="date" className={inp} value={draft.endDate} onChange={(e) => setC('endDate', e.target.value)} />
          </div>
          <div className="col-span-2">
            <button
              type="button"
              onClick={() => void handleSaveCampaign()}
              disabled={savingCamp}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={14} />
              {savingCamp ? '저장 중…' : '캠페인 추가'}
            </button>
          </div>
        </div>

        {/* 캠페인 목록 */}
        {sortedCampaigns.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-xs text-gray-400">
            등록된 캠페인이 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100">
            {sortedCampaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-gray-900">{c.name}</span>
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                      {c.month}
                    </span>
                    {c.productId && (
                      <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-600">
                        {productName(c.productId) || '품목?'}
                      </span>
                    )}
                  </div>
                  {(c.startDate || c.endDate) && (
                    <p className="text-[11px] text-gray-400">
                      {c.startDate || '—'} ~ {c.endDate || '—'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleToggleActive(c)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    c.active
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {c.active ? '활성' : '비활성'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteCampaign(c)}
                  aria-label="삭제"
                  className="shrink-0 rounded border border-red-200 p-1.5 text-red-400 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 타겟처 엑셀 업로드 ── */}
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <FileUp size={15} /> 타겟처 엑셀 업로드
        </h3>
        <p className="mb-3 text-xs leading-snug text-gray-500">
          의원/병원 포맷을 <strong>헤더로 자동 감지</strong>합니다.
          <br />• 의원: 거래처코드 · 거래처명 · 사업부명 · 팀명 · 담당자사번 · 담당자명
          <br />• 병원: 거래처코드 · 거래처명 · Dr.명 · 사업부명 · 팀명 · 담당자사번 · 담당자명
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inp} w-auto`}
            value={uploadCampaignId}
            onChange={(e) => setUploadCampaignId(e.target.value)}
          >
            <option value="">캠페인 선택…</option>
            {sortedCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.month})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            기존 타겟처 교체
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing || !uploadCampaignId}
            className="flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <FileUp size={14} />
            {importing ? '업로드 중…' : '엑셀 선택'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
        </div>
      </section>

      {/* ── 대시보드 ── */}
      <section className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-700">진행률 대시보드</h3>
          <div className="flex items-center gap-2">
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
              value={dashProductId}
              onChange={(e) => setDashProductId(e.target.value)}
            >
              <option value="all">전체 품목</option>
              {sortedProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="all">전체 월</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="max-w-[10rem] rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
              value={dashCampaignId}
              onChange={(e) => setDashCampaignId(e.target.value)}
            >
              <option value="all">전체 캠페인</option>
              {scopedCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loadingDash}
              className="flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loadingDash ? 'animate-spin' : ''} />
              새로고침
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={teamStats.length === 0}
              className="flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={13} />
              엑셀
            </button>
          </div>
        </div>

        {/* 전체 진행률 */}
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">
              {dashCampaignId === 'all' ? '전체 진행률' : '캠페인 진행률'}
            </span>
            <span className="text-xs text-gray-500">
              {dashCampaignId === 'all'
                ? month === 'all'
                  ? '전체 월'
                  : month
                : scopedCampaigns.find((c) => c.id === dashCampaignId)?.name}
            </span>
          </div>
          <ProgressBar done={overall.done} total={overall.total} />
        </div>

        {/* 캠페인별 진행률 (전체 캠페인 모드일 때만) */}
        {dashCampaignId === 'all' && campaignStats.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">캠페인별</h4>
            <div className="space-y-2 rounded-lg border border-gray-100 p-3">
              {campaignStats.map(({ campaign, done, total }) => (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => setDashCampaignId(campaign.id)}
                  className="grid w-full grid-cols-[10rem_1fr] items-center gap-2 rounded px-1 py-1 text-left hover:bg-gray-50"
                  title="클릭하면 이 캠페인만 봅니다"
                >
                  <span className="truncate text-xs text-gray-700">
                    {campaign.name}
                    <span className="ml-1 text-[10px] text-gray-400">{campaign.month}</span>
                  </span>
                  <ProgressBar done={done} total={total} />
                </button>
              ))}
            </div>
          </div>
        )}

        {teamStats.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
            {loadingDash ? '불러오는 중…' : '표시할 타겟처가 없습니다. (캠페인 업로드 후 새로고침)'}
          </p>
        ) : (
          <div className="space-y-4">
            {byDivision.map(([division, teams]) => {
              const dTotal = teams.reduce((s, t) => s + t.total, 0);
              const dDone = teams.reduce((s, t) => s + t.done, 0);
              return (
                <div key={division}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">{division}</h4>
                    <span className="text-[11px] text-gray-400">
                      {dDone}/{dTotal}
                    </span>
                  </div>
                  <div className="space-y-2 rounded-lg border border-gray-100 p-3">
                    {teams.map((t) => (
                      <div key={t.team} className="grid grid-cols-[7rem_1fr] items-center gap-2">
                        <span className="truncate text-xs text-gray-700" title={t.team}>
                          {t.team}
                        </span>
                        <ProgressBar done={t.done} total={t.total} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 담당자별 상세 */}
            <div>
              <button
                type="button"
                onClick={() => setShowReps((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                담당자별 상세 ({repStats.length}명)
                {showReps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showReps && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">담당자</th>
                        <th className="px-2 py-1.5 font-medium">사업부</th>
                        <th className="px-2 py-1.5 font-medium">팀</th>
                        <th className="px-2 py-1.5 font-medium">진행</th>
                        <th className="w-32 px-2 py-1.5 font-medium">진행률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {repStats.map((r) => {
                        const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
                        return (
                          <tr key={r.empNo || r.empName}>
                            <td className="px-2 py-1.5 text-gray-800">
                              {r.empName || '—'}
                              {r.empNo && <span className="ml-1 text-gray-400">{r.empNo}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-gray-500">{r.division}</td>
                            <td className="px-2 py-1.5 text-gray-500">{r.team}</td>
                            <td className="px-2 py-1.5 text-gray-600">
                              {r.done}/{r.total}
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                                  <div
                                    className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="w-8 text-right text-gray-500">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
