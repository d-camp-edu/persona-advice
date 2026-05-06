import { useAdminStore, type AdminTab } from '../store/useAdminStore';
import { useSessionStore } from '../store/useSessionStore';
import AdminGate from '../components/admin/AdminGate';
import SettingsTab from '../components/admin/SettingsTab';
import PatientsTab from '../components/admin/PatientsTab';
import MedsTab from '../components/admin/MedsTab';
import RulesTab from '../components/admin/RulesTab';
import AllowedTab from '../components/admin/AllowedTab';
import ExemptionsTab from '../components/admin/ExemptionsTab';
import HistoryTab from '../components/admin/HistoryTab';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'settings', label: '설정' },
  { id: 'patients', label: '환자 관리' },
  { id: 'meds', label: '약제 관리' },
  { id: 'rules', label: '삭감 규칙' },
  { id: 'allowed', label: '허용 조합' },
  { id: 'exemptions', label: '부작용 면제' },
  { id: 'history', label: '세션 이력' },
];

export default function AdminScreen() {
  const isAuthed = useAdminStore((s) => s.isAuthed);
  const activeTab = useAdminStore((s) => s.activeTab);
  const setTab = useAdminStore((s) => s.setTab);
  const logout = useAdminStore((s) => s.logout);
  const exitAdmin = useSessionStore((s) => s.exitAdmin);

  if (!isAuthed) return <AdminGate />;

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <h1 className="text-sm font-bold text-gray-900">Admin 콘솔</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            로그아웃
          </button>
          <button
            type="button"
            onClick={exitAdmin}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            나가기
          </button>
        </div>
      </div>

      {/* 탭 바 */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-white">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={`flex-shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'patients' && <PatientsTab />}
        {activeTab === 'meds' && <MedsTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'allowed' && <AllowedTab />}
        {activeTab === 'exemptions' && <ExemptionsTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}
