import { ArrowDown, ArrowUp } from 'lucide-react';

export type BetterDirection = 'down' | 'up';

interface MetricRowProps {
  label: string;
  unit: string;
  oldValue: number | '';
  newValue: number | '';
  better: BetterDirection;
  /** 소수점 자리수. 미지정 시 정수 */
  digits?: number;
}

/**
 * 변동 없거나 환자가 가지고 있지 않은 지표(0 또는 '')는 행 자체를 숨긴다.
 * better='down'이면 감소가 개선(초록), 증가가 악화(빨강).
 * better='up'이면 반대.
 */
export default function MetricRow({
  label,
  unit,
  oldValue,
  newValue,
  better,
  digits,
}: MetricRowProps) {
  if (oldValue === '' || oldValue === 0) return null;
  if (newValue === '' || newValue === 0) return null;
  const oldNum = oldValue;
  const newNum = newValue;
  const diff = newNum - oldNum;
  if (Math.abs(diff) < 1e-9) return null;

  const improved = better === 'down' ? diff < 0 : diff > 0;
  const tone = improved
    ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
    : 'text-red-600 bg-red-50 border-red-100';
  const Icon = diff < 0 ? ArrowDown : ArrowUp;

  const fmt = (v: number) => (typeof digits === 'number' ? v.toFixed(digits) : String(v));

  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${tone}`}>
      <div className="flex items-baseline gap-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-[10px] text-gray-400">{unit}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <span className="text-gray-500">{fmt(oldNum)}</span>
        <span className="text-gray-400">→</span>
        <span>{fmt(newNum)}</span>
        <Icon size={14} className="ml-0.5" />
      </div>
    </div>
  );
}
