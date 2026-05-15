import { User } from 'lucide-react';
import Badge from '../common/Badge';
import type { Comorbidity, Patient } from '../../types';
import { colorForComorb, genderLabel, typeBadgeColor } from './patientStyle';

interface PatientInfoCardProps {
  patient: Patient;
  currentHba1c: number;
  comorbidities: Comorbidity[];
}

export default function PatientInfoCard({
  patient,
  currentHba1c,
  comorbidities,
}: PatientInfoCardProps) {
  const hba1cChanged = Math.abs(currentHba1c - patient.initialHba1c) > 0.0001;

  return (
    <div className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* Patient photo */}
      <div className="flex-shrink-0">
        {patient.imageUrl ? (
          <img
            src={patient.imageUrl}
            alt={patient.name}
            className="h-14 w-14 rounded-xl object-cover border border-gray-100"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
              const fallback = el.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`h-14 w-14 items-center justify-center rounded-xl bg-slate-100 border border-gray-100 ${patient.imageUrl ? 'hidden' : 'flex'}`}
        >
          <User size={20} className="text-slate-400" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-base font-semibold text-gray-900">{patient.name}</span>
            <span className="text-xs text-gray-500">
              {patient.age}세 {genderLabel(patient.gender)}
            </span>
          </div>
          <Badge color={typeBadgeColor(patient.type)}>{patient.type}</Badge>
        </div>

        <div className="mb-1.5 flex items-baseline gap-2 text-xs text-gray-500">
          <span>BMI {patient.bmi}</span>
          <span className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold text-rose-600">{currentHba1c.toFixed(1)}%</span>
            {hba1cChanged && (
              <span className="text-[10px] text-gray-400">Base {patient.initialHba1c}%</span>
            )}
          </span>
        </div>

        {patient.comorbidities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {patient.comorbidities.map((name) => (
              <Badge key={name} color={colorForComorb(name, comorbidities)}>
                {name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
