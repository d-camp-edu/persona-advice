import type { AdminTab } from '../../store/useAdminStore';

interface AdminTabsProps {
  active: AdminTab;
  onChange: (t: AdminTab) => void;
}

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'settings', label: '설정' },
  { id: 'patients', label: '환자' },
  { id: 'meds', label: '약제' },
  { id: 'rules', label: '삭감규칙' },
  { id: 'allowed', label: '허용조합' },
  { id: 'exemptions', label: '부작용면제' },
  { id: 'history', label: '이력' },
];

export default function AdminTabs({ active, onChange }: AdminTabsProps) {
  return (
    <nav className="flex overflow-x-auto border-b border-gray-100 bg-white">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`shrink-0 px-3 py-2.5 text-xs font-semibold transition ${
              isActive
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'border-b-2 border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
