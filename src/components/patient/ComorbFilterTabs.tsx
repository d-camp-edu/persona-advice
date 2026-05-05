import type { Comorbidity } from '../../types';

const FILTER_ALL = '전체';

interface ComorbFilterTabsProps {
  comorbidities: Comorbidity[];
  value: string;
  onChange: (next: string) => void;
}

const HIDDEN_AS_FILTER = new Set(['전반적 개선']);

export default function ComorbFilterTabs({ comorbidities, value, onChange }: ComorbFilterTabsProps) {
  const items: string[] = [
    FILTER_ALL,
    ...comorbidities.filter((c) => !HIDDEN_AS_FILTER.has(c.name)).map((c) => c.name),
  ];

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-2 pb-1">
        {items.map((name) => {
          const active = value === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { FILTER_ALL };
