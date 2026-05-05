import { ChevronRight } from 'lucide-react';
import type { BadgeColor } from '../common/Badge';
import Badge from '../common/Badge';
import type { Comorbidity, Patient } from '../../types';

interface PatientCardProps {
  patient: Patient;
  comorbidities: Comorbidity[];
  onSelect: (id: string) => void;
}

const ALLOWED_BADGE_COLORS: ReadonlySet<BadgeColor> = new Set([
  'gray',
  'blue',
  'yellow',
  'green',
  'red',
  'orange',
  'purple',
]);

function colorForComorb(name: string, comorbidities: Comorbidity[]): BadgeColor {
  const c = comorbidities.find((x) => x.name === name);
  if (!c?.color) return 'gray';
  return ALLOWED_BADGE_COLORS.has(c.color as BadgeColor) ? (c.color as BadgeColor) : 'gray';
}

function typeBadgeColor(type: Patient['type']): BadgeColor {
  if (type === '초진') return 'blue';
  if (type === '재진') return 'green';
  return 'purple'; // 리핏
}

export default function PatientCard({ patient, comorbidities, onSelect }: PatientCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(patient.id)}
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] hover:border-indigo-200 hover:shadow-md"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-gray-900">{patient.name}</span>
          <span className="text-xs text-gray-500">
            {patient.age}세 {patient.gender === 'M' ? '남' : '여'}
          </span>
        </div>
        <Badge color={typeBadgeColor(patient.type)}>{patient.type}</Badge>
      </div>

      <div className="mb-2 text-sm">
        <span className="text-gray-500">현재 HbA1c: </span>
        <span className="font-semibold text-gray-900">{patient.initialHba1c}%</span>
      </div>

      {patient.comorbidities.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {patient.comorbidities.map((name) => (
            <Badge key={name} color={colorForComorb(name, comorbidities)}>
              {name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="line-clamp-2 flex-1 text-xs italic text-gray-500">"{patient.desc}"</p>
        <ChevronRight size={18} className="shrink-0 text-indigo-400" />
      </div>
    </button>
  );
}
