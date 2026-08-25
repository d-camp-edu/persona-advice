import { useState } from 'react';
import { Download, RefreshCw, Trash2, FileSpreadsheet } from 'lucide-react';
import { loadAllRxSessions, deleteAllRxSessions } from '../../lib/sessionRepo';
import {
  loadAllSurveyResponses,
  loadAllGiftLogs,
  deleteAllSurveyResponses,
  deleteAllGiftLogs,
} from '../../lib/logsRepo';
import { loadAllCompletions } from '../../lib/targetsRepo';
import { sessionsToCSV, downloadCSV } from '../../lib/csv';
import { downloadWorkbook } from '../../lib/excel';
import { buildUnifiedSheet, fmtTs as fmt } from '../../lib/historyExport';
import { useDataStore } from '../../store/useDataStore';
import type { GiftLog, RxSession, SurveyResponse, TargetCompletion } from '../../types';


export default function HistoryTab() {
  const questions = useDataStore((s) => s.surveyQuestions);
  const loginFields = useDataStore((s) => s.settings.loginFields ?? []);
  const campaigns = useDataStore((s) => s.targetCampaigns);

  const [sessions, setSessions] = useState<RxSession[] | null>(null);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [giftLogs, setGiftLogs] = useState<GiftLog[]>([]);
  const [completions, setCompletions] = useState<TargetCompletion[]>([]);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  };

  const handleLoad = async () => {
    setLoading(true);
    try {
      const [sess, svs, gifts, comps] = await Promise.all([
        loadAllRxSessions(),
        loadAllSurveyResponses(),
        loadAllGiftLogs(),
        loadAllCompletions(),
      ]);
      setSessions(sess);
      setSurveys(svs);
      setGiftLogs(gifts);
      comps.sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0));
      setCompletions(comps);
    } catch {
      showFlash('로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!sessions) return;
    // 처방·서베이·룰렛·타겟진행을 세션×환자 1행으로 합친 시트 1장.
    const sheet = buildUnifiedSheet({
      sessions,
      surveys,
      giftLogs,
      completions,
      questions,
      loginFields,
      campaigns,
    });
    const now = new Date().toISOString().slice(0, 10);
    downloadWorkbook(`persona_rx_기록_${now}.xls`, [sheet]);
  };

  const handleExportCSV = () => {
    if (!sessions || sessions.length === 0) return;
    const content = sessionsToCSV(sessions);
    const now = new Date().toISOString().slice(0, 10);
    downloadCSV(`rx_sessions_${now}.csv`, content);
  };

  const handleClearAll = async () => {
    if (!confirm('모든 기록(처방·서베이·룰렛)을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    setLoading(true);
    try {
      await Promise.all([
        deleteAllRxSessions(),
        deleteAllSurveyResponses(),
        deleteAllGiftLogs(),
      ]);
      setSessions([]);
      setSurveys([]);
      setGiftLogs([]);
      showFlash('전체 삭제됨');
    } catch {
      showFlash('삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const totalPrescriptions = sessions?.reduce((sum, s) => sum + s.prescriptions.length, 0) ?? 0;
  const loaded = sessions !== null;
  const hasAny =
    loaded &&
    (sessions!.length > 0 || surveys.length > 0 || giftLogs.length > 0 || completions.length > 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleLoad()}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '로드 중…' : '이력 로드'}
        </button>

        {hasAny && (
          <>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              엑셀 전체 내보내기 (통합 1시트)
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              <Download className="h-3.5 w-3.5" />
              처방 CSV
            </button>
            <button
              type="button"
              onClick={() => void handleClearAll()}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              전체 삭제
            </button>
          </>
        )}
      </div>

      {flash && <p className="mb-2 text-sm font-medium text-indigo-600">{flash}</p>}

      {!loaded && (
        <p className="py-8 text-center text-sm text-gray-400">
          '이력 로드'를 눌러 Firestore에서 처방·서베이·룰렛 기록을 가져오세요.
        </p>
      )}

      {loaded && !hasAny && (
        <p className="py-8 text-center text-sm text-gray-400">저장된 기록이 없습니다.</p>
      )}

      {hasAny && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="처방" value={`${totalPrescriptions}건`} sub={`세션 ${sessions!.length}개`} />
            <SummaryCard label="서베이" value={`${surveys.length}건`} />
            <SummaryCard label="타겟 완료" value={`${completions.length}건`} />
            <SummaryCard label="룰렛 보상" value={`${giftLogs.length}건`} />
          </div>

          {sessions!.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">처방 세션</h3>
              <div className="flex flex-col gap-3">
                {sessions!.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          )}

          {completions.length > 0 && (
            <CollapsibleList title={`타겟 진행 완료 (${completions.length}건)`} defaultOpen>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">완료일시</th>
                      <th className="px-2 py-1.5 font-medium">품목</th>
                      <th className="px-2 py-1.5 font-medium">사업부·팀</th>
                      <th className="px-2 py-1.5 font-medium">담당자</th>
                      <th className="px-2 py-1.5 font-medium">연락처</th>
                      <th className="px-2 py-1.5 font-medium">거래처</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {completions.map((c) => (
                      <tr key={c.id}>
                        <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">{fmt(c.completedAt)}</td>
                        <td className="px-2 py-1.5 text-indigo-600">{c.productName || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-600">
                          {[c.division, c.team].filter(Boolean).join(' · ')}
                        </td>
                        <td className="px-2 py-1.5 text-gray-800">
                          {c.empName || '—'}
                          {c.empNo && <span className="ml-1 text-gray-400">{c.empNo}</span>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-gray-600">{c.empPhone || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-700">
                          {c.name}
                          {c.doctorName && c.doctorName !== c.name && (
                            <span className="ml-1 text-gray-400">{c.doctorName}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleList>
          )}

          {surveys.length > 0 && (
            <CollapsibleList title={`서베이 응답 (${surveys.length}건)`}>
              <div className="divide-y divide-gray-100">
                {surveys.map((sv) => (
                  <div key={sv.id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        {sv.loginFieldValues?.['담당자'] || sv.doctorName || '—'}
                        {sv.loginFieldValues?.['사번'] && (
                          <span className="ml-1 text-gray-400">{sv.loginFieldValues['사번']}</span>
                        )}
                        <span className="ml-1.5 text-gray-400">· {sv.hospitalName}</span>
                        {sv.patientName && <span className="ml-1 text-gray-400">· {sv.patientName}</span>}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">{fmt(sv.answeredAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleList>
          )}
        </>
      )}
    </div>
  );
}

function CollapsibleList({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 overflow-hidden rounded-lg bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function SessionCard({ session }: { session: RxSession }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <span className="text-sm font-semibold text-gray-900">
            {session.hospitalName}
            {session.department && ` ${session.department}`} · {session.doctorName}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {session.createdAt.slice(0, 10)} · 처방 {session.prescriptions.length}건
          </span>
        </div>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {session.prescriptions.map((p, i) => (
            <div key={p.id ?? i} className="border-b border-gray-50 px-4 py-2 last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{p.patientName}</span>
                <span className="text-xs text-gray-400">{p.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                HbA1c {p.oldHba1c.toFixed(1)} → {p.newHba1c.toFixed(1)}%
                {p.prescribedDrugs.length > 0 && (
                  <span className="ml-2">
                    [{p.prescribedDrugs.map((d) => d.name).join(', ')}]
                  </span>
                )}
              </p>
              {p.deductionReasons.length > 0 && (
                <p className="mt-0.5 text-xs text-red-500">⚠ {p.deductionReasons.join(' / ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
