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

  const canvas = (() => {
    if (status === 'loading' || status === 'idle') {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white text-sm text-gray-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
          <p>설정을 불러오는 중…</p>
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
      <div className="h-full w-full bg-white">
        {phase === 'login' && <LoginScreen />}
        {phase === 'survey' && <SurveyScreen />}
        {phase === 'select' && <PatientSelectScreen />}
        {phase === 'rx' && <PrescribeScreen />}
        {phase === 'result' && <ResultReportScreen />}
        {phase === 'admin' && <AdminScreen />}
        {phase === 'myresults' && <MyResultsScreen />}
      </div>
    );
  })();

  // 실제 뷰포트 크기로 그대로 렌더링한다 (transform: scale 사용 안 함).
  // - 폰/태블릿 세로: max-w-[640px] 모바일 단일 컬럼 디자인
  // - 태블릿 가로(≥1024px, lg:): 각 화면이 가로 폭을 활용하도록 2단으로 재배치
  // 각 화면은 h-full 로 컨테이너 높이를 채우고, 넘치는 부분만 내부 스크롤한다.
  return (
    <div className="h-full w-full overflow-hidden bg-[#f5f5f7]">
      <div className="mx-auto h-full w-full max-w-[640px] lg:max-w-[1600px]">
        {canvas}
      </div>
    </div>
  );
}
