import { useState } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { loadAllRxSessions, deleteAllRxSessions } from '../../lib/sessionRepo';
import { sessionsToCSV, downloadCSV } from '../../lib/csv';
import type { RxSession } from '../../types';

export default function HistoryTab() {
  const [sessions, setSessions] = useState<RxSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('');

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 3000);
  };

  const handleLoad = async () => {
    setLoading(true);
    try {
      const data = await loadAllRxSessions();
      setSessions(data);
    } catch {
      showFlash('로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!sessions || sessions.length === 0) return;
    const content = sessionsToCSV(sessions);
    const now = new Date().toISOString().slice(0, 10);
    downloadCSV(`rx_sessions_${now}.csv`, content);
  };

  const handleClearAll = async () => {
    if (!confirm('모든 세션 이력을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    setLoading(true);
    try {
      await deleteAllRxSessions();
      setSessions([]);
      showFlash('전체 삭제됨');
    } catch {
      showFlash('삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const totalPrescriptions = sessions?.reduce((sum, s) => sum + s.prescriptions.length, 0) ?? 0;

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

        {sessions && sessions.length > 0 && (
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV 내보내기
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

      {sessions === null && (
        <p className="py-8 text-center text-sm text-gray-400">
          '이력 로드'를 눌러 Firestore에서 세션 데이터를 가져오세요.
        </p>
      )}

      {sessions !== null && sessions.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">저장된 세션 이력이 없습니다.</p>
      )}

      {sessions !== null && sessions.length > 0 && (
        <>
          <p className="mb-2 text-xs text-gray-500">
            세션 {sessions.length}개 · 처방 {totalPrescriptions}건
          </p>
          <div className="flex flex-col gap-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </>
      )}
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
            {session.hospitalName} · {session.doctorName}
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
