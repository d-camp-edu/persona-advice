import { useEffect } from 'react';
import { useDataStore } from './store/useDataStore';
import { useSessionStore } from './store/useSessionStore';
import LoginScreen from './screens/LoginScreen';
import SurveyScreen from './screens/SurveyScreen';
import PatientSelectScreen from './screens/PatientSelectScreen';
import PrescribeScreen from './screens/PrescribeScreen';
import ResultReportScreen from './screens/ResultReportScreen';
import AdminScreen from './screens/AdminScreen';
import MyResultsScreen from './screens/MyResultsScreen';

export default function App() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const bootstrap = useDataStore((s) => s.bootstrap);

  const phase = useSessionStore((s) => s.phase);

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
      {phase === 'survey' && <SurveyScreen />}
      {phase === 'select' && <PatientSelectScreen />}
      {phase === 'rx' && <PrescribeScreen />}
      {phase === 'result' && <ResultReportScreen />}
      {phase === 'admin' && <AdminScreen />}
      {phase === 'myresults' && <MyResultsScreen />}
    </div>
  );
}
