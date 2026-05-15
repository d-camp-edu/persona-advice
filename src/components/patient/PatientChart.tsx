import { User } from 'lucide-react';
import Badge from '../common/Badge';
import type { Medication, Patient } from '../../types';
import { useDataStore } from '../../store/useDataStore';
import { colorForComorb, genderLabel, typeBadgeColor } from './patientStyle';

interface PatientChartProps {
  patient: Patient;
  currentHba1c: number;
  medications: Medication[];
}

interface LabRow {
  label: string;
  value: string;
  unit: string;
  show: boolean;
}

function buildLabRows(p: Patient): LabRow[] {
  return [
    { label: 'HbA1c', value: p.initialHba1c.toFixed(1), unit: '%', show: true },
    { label: 'eGFR', value: String(p.egfr), unit: 'ml/min/1.73m²', show: p.egfr > 0 },
    { label: 'UACR', value: String(p.uacr), unit: 'mg/g', show: p.uacr > 0 },
    { label: 'LVEF', value: String(p.lvef), unit: '%', show: p.lvef > 0 },
    { label: 'NYHA', value: `Class ${p.nyha}`, unit: '', show: p.nyha > 0 },
    { label: 'BNP', value: String(p.bnp), unit: 'pg/mL', show: p.bnp > 0 },
    { label: 'NT-proBNP', value: String(p.ntprobnp), unit: 'pg/mL', show: p.ntprobnp > 0 },
  ];
}

function resolvePrevDrugNames(p: Patient, meds: Medication[]): string[] {
  return p.prevDrugs
    .filter((id) => id && id.length > 0)
    .map((id) => meds.find((m) => m.id === id)?.name ?? id);
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-slate-800 px-4 py-2.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/90">{title}</h3>
    </div>
  );
}

export default function PatientChart({ patient, currentHba1c, medications }: PatientChartProps) {
  const settings = useDataStore((s) => s.settings);
  const labs = buildLabRows(patient).filter((r) => r.show);
  const prevNames = resolvePrevDrugNames(patient, medications);
  const hba1cChanged = Math.abs(currentHba1c - patient.initialHba1c) > 0.0001;
  const hasHistory = prevNames.length > 0 || patient.prevTreatment.trim().length > 0;

  const labsWithoutHba1c = labs.filter((l) => l.label !== 'HbA1c');

  return (
    <div className="space-y-3">
      {/* Section 1: 환자 정보 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <SectionHeader title="환자 정보" />
        <div className="bg-white p-4">
          {/* Photo + basic info row */}
          <div className="mb-4 flex gap-3">
            <div className="flex-shrink-0">
              {patient.imageUrl ? (
                <img
                  src={patient.imageUrl}
                  alt={patient.name}
                  className="h-20 w-20 rounded-xl object-cover border border-slate-200"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 border border-slate-200">
                  <User size={28} className="text-slate-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-slate-900">{patient.name}</span>
                <Badge color={typeBadgeColor(patient.type)}>{patient.type}</Badge>
              </div>
              <div className="space-y-0.5 text-xs text-slate-500">
                <p>{genderLabel(patient.gender)} / {patient.age}세</p>
                <p>체중 {patient.weight}kg &middot; BMI {patient.bmi}</p>
                <p>순응도: <span className={patient.adherence === '나쁨' ? 'font-semibold text-red-500' : 'text-slate-600'}>{patient.adherence}</span></p>
              </div>
            </div>
          </div>

          {/* HbA1c highlight */}
          <div className="mb-4 flex items-center gap-4 rounded-xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 px-4 py-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-0.5">현재 HbA1c</p>
              <p className="text-3xl font-extrabold text-rose-600 leading-none">
                {currentHba1c.toFixed(1)}
                <span className="text-lg font-bold">%</span>
              </p>
              {hba1cChanged && (
                <p className="mt-0.5 text-xs text-slate-400">초기: {patient.initialHba1c}%</p>
              )}
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs font-medium text-slate-500 mb-0.5">목표 범위</p>
              <p className="text-sm font-semibold text-slate-600">{'< 7.0%'}</p>
            </div>
          </div>

          {/* Comorbidities */}
          {patient.comorbidities.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-600">동반 질환</p>
              <div className="flex flex-wrap gap-1.5">
                {patient.comorbidities.map((name) => (
                  <Badge key={name} color={colorForComorb(name, settings.comorbidities)}>
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: 기존 복용약물 */}
      {hasHistory && (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <SectionHeader title="기존 복용약물" />
          <div className="bg-white">
            {prevNames.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="py-2 pl-4 text-left text-xs font-semibold text-slate-500">약물명</th>
                    <th className="py-2 pr-4 text-right text-xs font-semibold text-slate-500">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {prevNames.map((name, i) => (
                    <tr
                      key={i}
                      className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      <td className="py-2.5 pl-4 text-sm font-medium text-slate-800">{name}</td>
                      <td className="py-2.5 pr-4 text-right">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          복용 중
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {patient.prevTreatment.trim().length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500 mb-1">치료 이력</p>
                <p className="text-sm text-slate-700">{patient.prevTreatment}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 3: 내원 시 검사 결과 */}
      {labsWithoutHba1c.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <SectionHeader title="내원 시 검사 결과" />
          <div className="bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              {labsWithoutHba1c.map((lab) => (
                <div
                  key={lab.label}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <p className="mb-1 text-xs font-semibold text-slate-500">{lab.label}</p>
                  <p className="text-base font-bold text-slate-800 leading-tight">{lab.value}</p>
                  {lab.unit && (
                    <p className="mt-0.5 text-[10px] text-slate-400 leading-tight">{lab.unit}</p>
                  )}
                </div>
              ))}
              {/* Extra flags */}
              {patient.hfHospitalization && (
                <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2.5">
                  <p className="mb-1 text-xs font-semibold text-orange-600">심부전 입원력</p>
                  <p className="text-sm font-bold text-orange-700">있음</p>
                </div>
              )}
              {patient.dipstick && (
                <div className="rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2.5">
                  <p className="mb-1 text-xs font-semibold text-yellow-700">Dipstick</p>
                  <p className="text-sm font-bold text-yellow-800">양성</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patient's chief complaint */}
      {patient.desc && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="mb-1 text-xs font-semibold text-slate-500">환자 주호소</p>
          <p className="text-sm italic text-slate-700">"{patient.desc}"</p>
        </div>
      )}
    </div>
  );
}
