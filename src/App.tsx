import { useEffect } from 'react';
import { useDataStore } from './store/useDataStore';

export default function App() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const isUsingSeedFallback = useDataStore((s) => s.isUsingSeedFallback);
  const patients = useDataStore((s) => s.patients);
  const medications = useDataStore((s) => s.medications);
  const bootstrap = useDataStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <div className="mx-auto flex h-full max-w-mobile flex-col items-center justify-center gap-3 bg-white p-6 text-center">
      <h1 className="text-2xl font-bold">Persona Rx</h1>
      <p className="text-sm text-gray-500">당뇨 처방 시뮬레이터 — M2 부트스트랩 확인</p>

      <div className="mt-4 w-full rounded-xl border border-gray-200 p-4 text-left text-sm">
        <div>
          <span className="font-semibold">상태: </span>
          {status === 'loading' && <span className="text-amber-600">로딩 중…</span>}
          {status === 'ready' && <span className="text-green-600">준비 완료</span>}
          {status === 'error' && <span className="text-red-600">오류</span>}
          {status === 'idle' && <span className="text-gray-400">대기</span>}
        </div>
        {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
        <div className="mt-2">
          <span className="font-semibold">데이터 소스: </span>
          {isUsingSeedFallback ? (
            <span className="text-gray-600">시드 fallback (firebaseConfig 미설정 또는 빈 컬렉션)</span>
          ) : (
            <span className="text-blue-600">Firestore 연결됨</span>
          )}
        </div>
        <div className="mt-2">
          <span className="font-semibold">환자: </span>
          {patients.length}명
        </div>
        <div>
          <span className="font-semibold">약제: </span>
          {medications.length}종
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400">M3에서 로그인/환자 선택 화면 진행</p>
    </div>
  );
}
