import type { Medication, Patient } from '../../types';
import { genderLabel } from './patientStyle';

interface PatientChartProps {
  patient: Patient;
  currentHba1c: number;
  medications: Medication[];
}

interface LabRow {
  label: string;
  value: string;
  show: boolean;
}

function buildLabRows(p: Patient): LabRow[] {
  return [
    { label: 'eGFR', value: `${p.egfr} ml/min/1.73m²`, show: p.egfr > 0 },
    { label: 'UACR', value: `${p.uacr} mg/g`, show: p.uacr > 0 },
    { label: 'LVEF', value: `${p.lvef}%`, show: p.lvef > 0 },
    { label: 'NYHA', value: String(p.nyha), show: p.nyha > 0 },
    { label: 'BNP', value: `${p.bnp} pg/mL`, show: p.bnp > 0 },
    { label: 'NT-proBNP', value: `${p.ntprobnp} pg/mL`, show: p.ntprobnp > 0 },
  ];
}

function resolvePrevDrugNames(p: Patient, meds: Medication[]): string[] {
  return p.prevDrugs
    .filter((id) => id && id.length > 0)
    .map((id) => meds.find((m) => m.id === id)?.name ?? id);
}

export default function PatientChart({ patient, currentHba1c, medications }: PatientChartProps) {
  const labs = buildLabRows(patient).filter((r) => r.show);
  const prevNames = resolvePrevDrugNames(patient, medications);
  const hasHistory = prevNames.length > 0 || patient.prevTreatment.trim().length > 0;
  const hba1cChanged = Math.abs(currentHba1c - patient.initialHba1c) > 0.0001;

  return (
    <div className="space-y-4 text-sm leading-relaxed text-gray-700">
      <Section title="📋 환자 차트 요약">
        <Row>기본정보: {genderLabel(patient.gender)}/{patient.age}세</Row>
        <Row>체중: {patient.weight}kg / BMI: {patient.bmi}</Row>
        <Row>진료유형: {patient.type}</Row>
        <Row>
          현재 HbA1c: <span className="font-semibold text-gray-900">{currentHba1c.toFixed(1)}%</span>
          {hba1cChanged && (
            <span className="ml-1 text-xs text-gray-400">(Base: {patient.initialHba1c}%)</span>
          )}
        </Row>
        <Row>순응도: {patient.adherence}</Row>
      </Section>

      {labs.length > 0 && (
        <Section title="🔬 의학적 검사 수치">
          {labs.map((r) => (
            <Row key={r.label}>
              {r.label}: {r.value}
            </Row>
          ))}
        </Section>
      )}

      {patient.comorbidities.length > 0 && (
        <Section title="🩺 동반 질환">
          {patient.comorbidities.map((c) => (
            <Row key={c}>{c}</Row>
          ))}
        </Section>
      )}

      {hasHistory && (
        <Section title="💊 초기 내원 시 이력">
          {prevNames.length > 0 && <Row>복용약: {prevNames.join(', ')}</Row>}
          {patient.prevTreatment.trim().length > 0 && <Row>{patient.prevTreatment}</Row>}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">{title}</h3>
      <ul className="space-y-0.5 pl-1">{children}</ul>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm text-gray-700">
      <span className="mr-1 text-gray-400">•</span>
      {children}
    </li>
  );
}
