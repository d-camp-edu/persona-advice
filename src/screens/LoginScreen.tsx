import { useState } from 'react';
import { Settings, BarChart2, RotateCcw } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useSessionStore, type InstitutionType } from '../store/useSessionStore';

function loadLastLogin(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem('persona_rx_last_login');
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  const settings = useDataStore((s) => s.settings);
  const login = useSessionStore((s) => s.login);
  const loginPending = useSessionStore((s) => s.loginPending);
  const goAdmin = useSessionStore((s) => s.goAdmin);
  const goMyResults = useSessionStore((s) => s.goMyResults);

  const fields = [...(settings.loginFields ?? [])].sort((a, b) => a.order - b.order);
  const lastLogin = loadLastLogin();

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, ''])),
  );
  const [institutionType, setInstitutionType] = useState<InstitutionType>('병원');
  const [department, setDepartment] = useState<string>('');

  const departmentOptions = (settings.hospitalDepartments ?? []).filter(
    (d) => d.trim().length > 0,
  );

  const ready =
    !loginPending &&
    fields
      .filter((f) => f.required)
      .every((f) => (values[f.id] ?? '').trim().length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    void login(values, institutionType, institutionType === '병원' ? department : '');
  };

  const setValue = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center px-6 py-6"
      style={{
        background: `linear-gradient(135deg, ${settings.loginBgStart}, ${settings.loginBgEnd})`,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur lg:flex lg:max-h-[90vh] lg:w-full lg:max-w-4xl"
      >
        {/* 브랜딩 패널 — 가로 모드에서 왼쪽 */}
        <div className="p-6 pb-0 text-center lg:flex lg:w-[42%] lg:flex-col lg:items-center lg:justify-center lg:bg-gradient-to-br lg:from-indigo-50 lg:to-white lg:p-8 lg:pb-8">
          {settings.loginLogoUrl && (
            <img
              src={settings.loginLogoUrl}
              alt=""
              className="mx-auto mb-4 h-32 w-auto max-w-[220px] object-contain lg:h-40"
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

        {/* 입력 패널 — 가로 모드에서 오른쪽 (넘치면 내부 스크롤) */}
        <div className="p-6 pt-6 lg:flex-1 lg:overflow-y-auto lg:p-8">
        {fields.map((field, i) => (
          <div key={field.id}>
            <label className={`block ${i < fields.length - 1 ? 'mb-3' : 'mb-5'}`}>
              <span className="mb-1 block text-xs font-medium text-gray-600">
                {field.label}
                {field.required && <span className="ml-0.5 text-red-400">*</span>}
              </span>
              <input
                type="text"
                value={values[field.id] ?? ''}
                onChange={(e) => setValue(field.id, e.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                autoComplete="off"
              />
            </label>

            {field.id === 'hospital' && institutionType === '병원' && (
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-gray-600">분과</span>
                {departmentOptions.length > 0 ? (
                  <>
                    <input
                      type="text"
                      list="hospital-department-options"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="예: 내분비내과"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      autoComplete="off"
                    />
                    <datalist id="hospital-department-options">
                      {departmentOptions.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="예: 내분비내과"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    autoComplete="off"
                  />
                )}
              </label>
            )}
          </div>
        ))}

        {/* 기관 유형 선택 */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-gray-600">기관 유형</p>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {(['병원', '의원'] as InstitutionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setInstitutionType(type);
                  if (type === '의원') setDepartment('');
                }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  institutionType === type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {lastLogin && (
          <button
            type="button"
            onClick={() => {
              const merged = Object.fromEntries(fields.map((f) => [f.id, lastLogin[f.id] ?? '']));
              setValues(merged);
            }}
            className="mb-3 w-full flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition"
          >
            <RotateCcw size={14} />
            재접속 (이전 정보 불러오기)
          </button>
        )}

        <button
          type="submit"
          disabled={!ready}
          className="w-full rounded-lg py-3 text-sm font-semibold text-white shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: settings.loginBtnColor }}
        >
          {loginPending ? '세션 준비 중...' : '페르소나 자문 디테일 시작하기'}
        </button>

        <button
          type="button"
          onClick={goMyResults}
          className="mt-3 w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <BarChart2 size={15} />
          내가 한 자문 디테일 결과 조회
        </button>
        </div>
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
