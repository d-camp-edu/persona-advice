import { ChevronRight, User } from 'lucide-react';
import Badge from '../common/Badge';
import type { Comorbidity, Patient } from '../../types';
import { colorForComorb, genderLabel, typeBadgeColor } from './patientStyle';

interface PatientCardProps {
  patient: Patient;
  comorbidities: Comorbidity[];
  onSelect: (id: string) => void;
}

export default function PatientCard({ patient, comorbidities, onSelect }: PatientCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(patient.id)}
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99] hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex gap-3">
        {/* Patient photo */}
        <div className="flex-shrink-0">
          {patient.imageUrl ? (
            <img
              src={patient.imageUrl}
              alt={patient.name}
              className="h-16 w-16 rounded-xl object-cover border border-gray-100"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = 'none';
                const fallback = el.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className={`h-16 w-16 items-center justify-center rounded-xl bg-slate-100 border border-gray-100 ${patient.imageUrl ? 'hidden' : 'flex'}`}
          >
            <User size={22} className="text-slate-400" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-base font-semibold text-gray-900">{patient.name}</span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {patient.age}세 {genderLabel(patient.gender)}
              </span>
            </div>
            <Badge color={typeBadgeColor(patient.type)}>{patient.type}</Badge>
          </div>

          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="text-gray-500 text-xs">HbA1c</span>
            <span className="font-bold text-rose-600">{patient.initialHba1c}%</span>
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
            <p className="line-clamp-1 flex-1 text-xs italic text-gray-500">"{patient.desc}"</p>
            <ChevronRight size={16} className="flex-shrink-0 text-indigo-400" />
          </div>
        </div>
      </div>
    </button>
  );
}
