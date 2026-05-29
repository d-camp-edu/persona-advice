import { useEffect, useState } from 'react';
import { useDataStore } from './store/useDataStore';
import { useSessionStore } from './store/useSessionStore';
import LoginScreen from './screens/LoginScreen';
import SurveyScreen from './screens/SurveyScreen';
import PatientSelectScreen from './screens/PatientSelectScreen';
import PrescribeScreen from './screens/PrescribeScreen';
import ResultReportScreen from './screens/ResultReportScreen';
import AdminScreen from './screens/AdminScreen';
import MyResultsScreen from './screens/MyResultsScreen';

const DESIGN_WIDTH = 640;
const MAX_SCALE = 2.5;

function useFitScale() {
  const [vp, setVp] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : DESIGN_WIDTH,
    vh: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));
  useEffect(() => {
    const update = () => setVp({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  const scale = Math.min(vp.vw / DESIGN_WIDTH, MAX_SCALE);
  return { scale, vw: vp.vw, vh: vp.vh };
}

export default function App() {
  const status = useDataStore((s) => s.status);
  const error = useDataStore((s) => s.error);
  const bootstrap = useDataStore((s) => s.bootstrap);

  const phase = useSessionStore((s) => s.phase);
  const { scale, vh } = useFitScale();

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

  // 모바일 640px 디자인을 뷰포트 폭에 맞춰 transform: scale로 균일 확대/축소.
  // - 폰: 1× 이하로 축소되어 가로 오버플로우 없음
  // - 태블릿/노트북: 1.2~2.5× 균일 확대, 여백 없이 화면 가득
  // - 1600px 이상 모니터: 2.5× 캡 (글자가 비현실적으로 커지는 것 방지)
  // 모달(BrochureViewer, GiftRoulette, MedSelector)은 createPortal로
  // document.body에 그려 transform 영향 밖에서 진짜 viewport를 덮는다.
  const canvasHeight = vh / scale;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'white',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: `${DESIGN_WIDTH}px`,
          height: `${canvasHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          flexShrink: 0,
          background: 'white',
        }}
      >
        {canvas}
      </div>
    </div>
  );
}
