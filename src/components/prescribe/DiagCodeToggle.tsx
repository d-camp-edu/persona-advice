interface DiagOption {
  code: string;
  label: string;
}

const OPTIONS: DiagOption[] = [
  { code: 'E11', label: 'E11 당뇨' },
  { code: 'I50', label: 'I50 심부전' },
  { code: 'N18', label: 'N18 신장병' },
];

interface DiagCodeToggleProps {
  selected: string[];
  onToggle: (code: string) => void;
}

export default function DiagCodeToggle({ selected, onToggle }: DiagCodeToggleProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => {
        const active = selected.includes(opt.code);
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => onToggle(opt.code)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
