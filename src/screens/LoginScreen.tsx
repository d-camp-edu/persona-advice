import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useSessionStore } from '../store/useSessionStore';

export default function LoginScreen() {
  const settings = useDataStore((s) => s.settings);
  const login = useSessionStore((s) => s.login);
  const loginPending = useSessionStore((s) => s.loginPending);
  const goAdmin = useSessionStore((s) => s.goAdmin);

  const [hospital, setHospital] = useState('');
  const [doctor, setDoctor] = useState('');

  const ready = hospital.trim().length > 0 && doctor.trim().length > 0 && !loginPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    void login(hospital, doctor);
  };

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center px-6"
      style={{
        background: `linear-gradient(135deg, ${settings.loginBgStart}, ${settings.loginBgEnd})`,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur"
      >
        <div className="mb-6 text-center">
          {settings.loginLogoUrl && (
            <img
              src={settings.loginLogoUrl}
              alt=""
              className="mx-auto mb-3 h-12 w-12 object-contain"
            />
          )}
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-900">
            {settings.loginTitleIconUrl && (
              <img src={settings.loginTitleIconUrl} alt="" className="h-7 w-7 object-contain" />
            )}
            {settings.loginMainTitle}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{settings.loginSubTitle}</p>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-gray-600">병원명</span>
          <input
            type="text"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
            placeholder="예: 서울대학교병원 내분비내과"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            autoComplete="off"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1 block text-xs font-medium text-gray-600">선생님 이름</span>
          <input
            type="text"
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="예: 홍길동"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            autoComplete="off"
          />
        </label>

        <button
          type="submit"
          disabled={!ready}
          className="w-full rounded-lg py-3 text-sm font-semibold text-white shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: settings.loginBtnColor }}
        >
          {loginPending ? '세션 준비 중...' : '시뮬레이션 시작하기'}
        </button>
      </form>

      <button
        type="button"
        onClick={goAdmin}
        aria-label="관리자 모드"
        className="absolute bottom-4 right-4 rounded-full bg-white/20 p-2 text-white/80 backdrop-blur transition hover:bg-white/30 hover:text-white"
      >
        <Settings size={20} />
      </button>
    </div>
  );
}
