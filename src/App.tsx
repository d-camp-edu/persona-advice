import { useEffect } from 'react';
import { useDataStore } from './store/useDataStore';
import { useSessionStore } from './store/useSessionStore';
import LoginScreen from './screens/LoginScreen';
import PatientSelectScreen from './screens/PatientSelectScreen';

function PlaceholderScreen({ title, hint, onBack }: { title: string; hint: string; onBack: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white p-6 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-gray-500">{hint}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        돌아가기
      </button>
    </div>
  );
}

export default function App() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const bootstrap = useDataStore((s) => s.bootstrap);

  const phase = useSessionStore((s) => s.phase);
  const resetToSelect = useSessionStore((s) => s.resetToSelect);
  const exitAdmin = useSessionStore((s) => s.exitAdmin);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white text-sm text-gray-500">
        로딩 중…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold text-red-600">초기화 실패</h1>
        <p className="text-sm text-gray-500">{error ?? '알 수 없는 오류'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full w-full max-w-mobile bg-white">
      {phase === 'login' && <LoginScreen />}
      {phase === 'select' && <PatientSelectScreen />}
      {phase === 'rx' && (
        <PlaceholderScreen
          title="처방 화면 (M4 예정)"
          hint="환자가 선택되었습니다."
          onBack={resetToSelect}
        />
      )}
      {phase === 'result' && (
        <PlaceholderScreen
          title="결과 리포트 (M6 예정)"
          hint=""
          onBack={resetToSelect}
        />
      )}
      {phase === 'admin' && (
        <PlaceholderScreen
          title="Admin 콘솔 (M9 예정)"
          hint=""
          onBack={exitAdmin}
        />
      )}
    </div>
  );
}
