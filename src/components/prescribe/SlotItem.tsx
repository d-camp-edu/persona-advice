import type { Medication } from '../../types';

interface SlotItemProps {
  slotIndex: number; // 0..4
  medication: Medication | null;
  onChange: (slotIndex: number) => void;
}

export default function SlotItem({ slotIndex, medication, onChange }: SlotItemProps) {
  const isInsurance = slotIndex < 3;
  const tagLabel = isInsurance ? `급여 ${slotIndex + 1}` : `본인부담 ${slotIndex - 2}`;
  const tagClass = isInsurance
    ? 'bg-blue-100 text-blue-700'
    : 'bg-orange-100 text-orange-700';

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
      <span
        className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${tagClass}`}
      >
        {tagLabel}
      </span>
      <span
        className={`flex-1 truncate text-sm ${
          medication ? 'font-medium text-gray-900' : 'italic text-gray-400'
        }`}
      >
        {medication ? medication.name : '처방 약제 비어있음'}
      </span>
      <button
        type="button"
        onClick={() => onChange(slotIndex)}
        className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
      >
        변경
      </button>
    </div>
  );
}
