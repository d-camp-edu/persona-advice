import { useState } from 'react';
import { Download, RefreshCw, Trash2, FileSpreadsheet } from 'lucide-react';
import { loadAllRxSessions, deleteAllRxSessions } from '../../lib/sessionRepo';
import {
  loadAllSurveyResponses,
  loadAllGiftLogs,
  deleteAllSurveyResponses,
  deleteAllGiftLogs,
} from '../../lib/logsRepo';
import { sessionsToCSV, downloadCSV } from '../../lib/csv';
import { downloadWorkbook, type Sheet, type CellValue } from '../../lib/excel';
import { useDataStore } from '../../store/useDataStore';
import type { GiftLog, RxSession, SurveyResponse, SurveyQuestion, LoginFieldDef } from '../../types';

/** ISO 문자열 → 'YYYY-MM-DD HH:mm' */
function fmt(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 16).replace('T', ' ');
}

function answerText(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(', ');
  return v ?? '';
}

function buildSheets(
  sessions: RxSession[],
  surveys: SurveyResponse[],
  giftLogs: GiftLog[],
  questions: SurveyQuestion[],
  loginFields: LoginFieldDef[],
): Sheet[] {
  const fields = [...loginFields].sort((a, b) => a.order - b.order);
  const fieldVals = (fv?: Record<string, string>): CellValue[] =>
    fields.map((f) => fv?.[f.id] ?? '');
  const fieldHeaders = fields.map((f) => f.label);

  // 1) 처방 기록
  const rxHeaders = [
    '일시',
    '병원',
    '분과',
    '의사',
    '환자',
    '약제1',
    '약제2',
    '약제3',
    '약제4',
    '약제5',
    '이전HbA1c',
    '새HbA1c',
    '부작용',
    '삭감사유',
    '병포장보너스',
    '순응도나쁨',
    ...fieldHeaders,
  ];
  const rxRows: CellValue[][] = sessions.flatMap((s) =>
    s.prescriptions.map((p) => {
      const drugs = Array.from({ length: 5 }, (_, i) => {
        const found = p.prescribedDrugs.find((d) => d.slot === i);
        return found ? found.name : '';
      });
      return [
        fmt(p.timestamp),
        s.hospitalName,
        s.department ?? '',
        s.doctorName,
        p.patientName,
        ...drugs,
        Number(p.oldHba1c.toFixed(1)),
        Number(p.newHba1c.toFixed(1)),
        p.sideEffects.join('; '),
        p.deductionReasons.join('; '),
        p.isPackagingBonus ? 'O' : '',
        p.isPoorAdherence ? 'O' : '',
        ...fieldVals(s.loginFieldValues),
      ];
    }),
  );

  // 2) 서베이
  const sortedQ = [...questions].sort((a, b) => a.order - b.order);
  const surveyHeaders = [
    '일시',
    '병원',
    '분과',
    '의사',
    '환자',
    '기관유형',
    ...sortedQ.map((q) => q.text),
    ...fieldHeaders,
  ];
  const surveyRows: CellValue[][] = surveys.map((sv) => [
    fmt(sv.answeredAt),
    sv.hospitalName,
    sv.department ?? '',
    sv.doctorName,
    sv.patientName ?? '',
    sv.institutionType ?? '',
    ...sortedQ.map((q) => answerText(sv.answers?.[q.id])),
    ...fieldVals(sv.loginFieldValues),
  ]);

  // 3) 룰렛 보상
  const giftHeaders = [
    '일시',
    '병원',
    '분과',
    '의사',
    '환자',
    '기관유형',
    '결과',
    '당첨여부',
    ...fieldHeaders,
  ];
  const giftRows: CellValue[][] = giftLogs.map((g) => [
    fmt(g.spunAt),
    g.hospitalName,
    g.department ?? '',
    g.doctorName,
    g.patientName,
    g.institutionType ?? '',
    g.giftName,
    g.isWin ? '당첨' : '꽝',
    ...fieldVals(g.loginFieldValues),
  ]);

  return [
    { name: '처방기록', headers: rxHeaders, rows: rxRows },
    { name: '서베이', headers: surveyHeaders, rows: surveyRows },
    { name: '룰렛보상', headers: giftHeaders, rows: giftRows },
  ];
}

export default function HistoryTab() {
  const questions = useDataStore((s) => s.surveyQuestions);
  const loginFields = useDataStore((s) => s.settings.loginFields ?? []);

  const [sessions, setSessions] = useState<RxSession[] | null>(null);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);
  const [giftLogs, setGiftLogs] = useState<GiftLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  };

  const handleLoad = async () => {
    setLoading(true);
    try {
      const [sess, svs, gifts] = await Promise.all([
        loadAllRxSessions(),
        loadAllSurveyResponses(),
        loadAllGiftLogs(),
      ]);
      setSessions(sess);
      setSurveys(svs);
      setGiftLogs(gifts);
    } catch {
      showFlash('로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!sessions) return;
    const sheets = buildSheets(sessions, surveys, giftLogs, questions, loginFields);
    const now = new Date().toISOString().slice(0, 10);
    downloadWorkbook(`persona_rx_기록_${now}.xls`, sheets);
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
  const hasAny = loaded && (sessions!.length > 0 || surveys.length > 0 || giftLogs.length > 0);

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
              엑셀 전체 내보내기 (탭별)
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
          <div className="mb-3 grid grid-cols-3 gap-2">
            <SummaryCard label="처방" value={`${totalPrescriptions}건`} sub={`세션 ${sessions!.length}개`} />
            <SummaryCard label="서베이" value={`${surveys.length}건`} />
            <SummaryCard label="룰렛 보상" value={`${giftLogs.length}건`} />
          </div>

          <div className="flex flex-col gap-3">
            {sessions!.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </>
      )}
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
