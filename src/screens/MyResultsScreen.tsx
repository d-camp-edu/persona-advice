import { useState } from 'react';
import { ArrowLeft, Search, User, ClipboardList, Pill, MessageSquare } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore';
import { useDataStore } from '../store/useDataStore';
import { loadAllRxSessions } from '../lib/sessionRepo';
import { getDocs, collection } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../lib/firebase';
import { collectionPath } from '../lib/firestoreApi';
import type { RxSession, SurveyResponse } from '../types';

interface ResultCard {
  doctorName: string;
  hospitalName: string;
  sessionCount: number;
  patientNames: string[];
  prescriptionCount: number;
  hasSurvey: boolean;
  surveyAnswerCount: number;
  lastActivity: string;
}

async function loadSurveyResponses(): Promise<SurveyResponse[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  if (!db) return [];
  const snap = await getDocs(collection(db, collectionPath('surveyResponses')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SurveyResponse, 'id'>) }));
}

function buildCards(
  sessions: RxSession[],
  surveys: SurveyResponse[],
  fieldValues: Record<string, string>,
): ResultCard[] {
  const myFieldEntries = Object.entries(fieldValues).filter(([, v]) => v.trim().length > 0);

  const mySessions = sessions.filter((s) => {
    if (!s.loginFieldValues) return false;
    const fv = s.loginFieldValues;
    return myFieldEntries.every(([k, v]) => fv[k] === v);
  });

  const grouped = new Map<string, RxSession[]>();
  for (const s of mySessions) {
    const key = `${s.doctorName}__${s.hospitalName}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  const surveyMap = new Map<string, SurveyResponse[]>();
  for (const sv of surveys) {
    if (!sv.loginFieldValues) continue;
    const svFv = sv.loginFieldValues;
    const matches = myFieldEntries.every(([k, v]) => svFv[k] === v);
    if (!matches) continue;
    const key = `${sv.doctorName}__${sv.hospitalName}`;
    if (!surveyMap.has(key)) surveyMap.set(key, []);
    surveyMap.get(key)!.push(sv);
  }

  const cards: ResultCard[] = [];
  for (const [key, sess] of grouped.entries()) {
    const [doctorName, hospitalName] = key.split('__');
    const patientSet = new Set<string>();
    let prescriptionCount = 0;
    let lastActivity = '';
    for (const s of sess) {
      for (const p of s.prescriptions ?? []) {
        patientSet.add(p.patientName);
        prescriptionCount++;
        if (!lastActivity || p.timestamp > lastActivity) lastActivity = p.timestamp;
      }
      if (!lastActivity || s.createdAt > lastActivity) lastActivity = s.createdAt;
    }
    const svs = surveyMap.get(key) ?? [];
    cards.push({
      doctorName,
      hospitalName,
      sessionCount: sess.length,
      patientNames: [...patientSet],
      prescriptionCount,
      hasSurvey: svs.length > 0,
      surveyAnswerCount: svs.reduce((n, s) => n + Object.keys(s.answers ?? {}).length, 0),
      lastActivity,
    });
  }

  cards.sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1));
  return cards;
}

export default function MyResultsScreen() {
  const resetToLogin = useSessionStore((s) => s.resetToLogin);
  const settings = useDataStore((s) => s.settings);
  const loginFields = settings.loginFields ?? [];

  const [searchValues, setSearchValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(loginFields.map((f) => [f.id, ''])),
  );
  const [cards, setCards] = useState<ResultCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    const filled = Object.values(searchValues).some((v) => v.trim().length > 0);
    if (!filled) {
      setError('최소 한 개 이상의 항목을 입력해 주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const [sessions, surveys] = await Promise.all([loadAllRxSessions(), loadSurveyResponses()]);
      const result = buildCards(sessions, surveys, searchValues);
      setCards(result);
    } catch (e) {
      setError('데이터 로드 실패: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        background: `linear-gradient(135deg, ${settings.loginBgStart}, ${settings.loginBgEnd})`,
      }}
    >
      <header className="flex items-center gap-3 px-4 py-4">
        <button
          type="button"
          onClick={resetToLogin}
          className="rounded-full bg-white/20 p-2 text-white backdrop-blur hover:bg-white/30"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-white">자문 디테일 결과 조회</h1>
          <p className="text-xs text-white/70">담당자 정보를 입력해 결과를 확인하세요</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="rounded-2xl bg-white/95 p-5 shadow-2xl backdrop-blur mb-4">
          {loginFields
            .slice()
            .sort((a, b) => a.order - b.order)
            .filter((f) => !['hospital', 'doctor'].includes(f.id))
            .map((field) => (
              <label key={field.id} className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-gray-600">{field.label}</span>
                <input
                  type="text"
                  value={searchValues[field.id] ?? ''}
                  onChange={(e) =>
                    setSearchValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  autoComplete="off"
                />
              </label>
            ))}

          {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50"
            style={{ backgroundColor: settings.loginBtnColor }}
          >
            <Search size={15} />
            {loading ? '조회 중...' : '결과 조회'}
          </button>
        </div>

        {cards !== null && (
          <>
            <p className="mb-3 text-sm font-semibold text-white">
              총 {cards.length}명의 선생님과 자문 디테일
            </p>
            {cards.length === 0 && (
              <div className="rounded-2xl bg-white/90 p-6 text-center text-sm text-gray-500">
                조회된 결과가 없습니다.
              </div>
            )}
            <div className="space-y-3">
              {cards.map((card, i) => (
                <ResultCardView key={i} card={card} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultCardView({ card }: { card: ResultCard }) {
  const dateStr = card.lastActivity
    ? new Date(card.lastActivity).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '-';

  return (
    <div className="rounded-2xl bg-white shadow-md overflow-hidden">
      <div className="bg-indigo-600 px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-indigo-200">{card.hospitalName}</p>
            <p className="text-base font-bold text-white">{card.doctorName} 선생님</p>
          </div>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
            {dateStr}
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        <StatBlock
          icon={<ClipboardList size={16} className="text-indigo-500" />}
          label="세션 수"
          value={`${card.sessionCount}회`}
        />
        <StatBlock
          icon={<Pill size={16} className="text-emerald-500" />}
          label="처방 수"
          value={`${card.prescriptionCount}건`}
        />
        <StatBlock
          icon={<User size={16} className="text-blue-500" />}
          label="환자 수"
          value={`${card.patientNames.length}명`}
        />
        <StatBlock
          icon={<MessageSquare size={16} className="text-amber-500" />}
          label="서베이"
          value={card.hasSurvey ? `완료 (${card.surveyAnswerCount}개 답변)` : '미완료'}
        />
      </div>

      {card.patientNames.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <p className="mb-2 text-xs font-semibold text-gray-500">진료 환자</p>
          <div className="flex flex-wrap gap-1">
            {card.patientNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
      {icon}
      <div>
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-800">{value}</p>
      </div>
    </div>
  );
}
