import { useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useSessionStore } from '../store/useSessionStore';
import ComorbFilterTabs, { FILTER_ALL } from '../components/patient/ComorbFilterTabs';
import PatientCard from '../components/patient/PatientCard';

export default function PatientSelectScreen() {
  const patients = useDataStore((s) => s.patients);
  const settings = useDataStore((s) => s.settings);
  const doctorName = useSessionStore((s) => s.doctorName);
  const filter = useSessionStore((s) => s.comorbFilter);
  const setFilter = useSessionStore((s) => s.setComorbFilter);
  const selectPatient = useSessionStore((s) => s.selectPatient);
  const resetToLogin = useSessionStore((s) => s.resetToLogin);

  const sorted = useMemo(
    () => [...patients].sort((a, b) => a.order - b.order),
    [patients],
  );

  const filtered = useMemo(() => {
    if (filter === FILTER_ALL) return sorted;
    return sorted.filter((p) => p.comorbidities.includes(filter));
  }, [sorted, filter]);

  return (
    <div className="flex h-full w-full flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-gray-900">
            {doctorName} 선생님,
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">어떤 환자를 시뮬레이션 해볼까요?</p>
        </div>
        <button
          type="button"
          onClick={resetToLogin}
          aria-label="로그아웃"
          className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <LogOut size={18} />
        </button>
      </header>

      <div className="border-b border-gray-100 bg-white px-4 py-3">
        <ComorbFilterTabs
          comorbidities={settings.comorbidities}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filtered.length === 0 ? (
          <p className="mt-12 text-center text-sm text-gray-400">
            해당 조건의 환자가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3 pb-6">
            {filtered.map((p) => (
              <li key={p.id}>
                <PatientCard
                  patient={p}
                  comorbidities={settings.comorbidities}
                  onSelect={selectPatient}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
