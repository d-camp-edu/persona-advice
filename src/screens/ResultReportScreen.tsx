import { useMemo } from 'react';
import { ArrowLeft, ClipboardList, Pill, Activity, AlertTriangle, ShieldCheck, MessageCircle } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { useSessionStore } from '../store/useSessionStore';
import MetricRow from '../components/result/MetricRow';
import Badge from '../components/common/Badge';
import { genderLabel, typeBadgeColor } from '../components/patient/patientStyle';
import type { PatientMetricDef, Prescription } from '../types';

export default function ResultReportScreen() {
  const lastResult = useSessionStore((s) => s.lastResult);
  const hospitalName = useSessionStore((s) => s.hospitalName);
  const doctorName = useSessionStore((s) => s.doctorName);
  const resetToSelect = useSessionStore((s) => s.resetToSelect);
  const resetToLogin = useSessionStore((s) => s.resetToLogin);

  const patients = useDataStore((s) => s.patients);
  const patientMetricDefs = useDataStore((s) => s.patientMetricDefs);

  const patient = useMemo(
    () => (lastResult ? patients.find((p) => p.id === lastResult.prescription.patientId) : null),
    [patients, lastResult],
  );

  if (!lastResult || !patient) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">표시할 처방 결과가 없습니다.</p>
        <button
          type="button"
          onClick={resetToSelect}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          환자 선택으로
        </button>
      </div>
    );
  }

  const { prescription } = lastResult;
  const hasSideEffects = prescription.sideEffects.length > 0;
  const comorbEntries = Object.entries(prescription.comorbFeedback);
  const hasDeductions = prescription.deductionReasons.length > 0;

  return (
    <div className="flex h-full w-full flex-col bg-gray-50">
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={resetToSelect}
          aria-label="환자 선택으로"
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 truncate text-sm font-semibold text-gray-700">처방 결과 리포트</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-24">
        <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
            <ClipboardList size={12} />
            <span>
              {doctorName} 선생님 · {hospitalName}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold text-gray-900">{patient.name}</span>
              <span className="text-xs text-gray-500">
                {patient.age}세 {genderLabel(patient.gender)}
              </span>
            </div>
            <Badge color={typeBadgeColor(patient.type)}>{patient.type}</Badge>
          </div>
        </section>

        <Section title="처방 약제" icon={<Pill size={14} />}>
          {prescription.prescribedDrugs.length === 0 ? (
            <p className="text-xs text-gray-500">선택된 약제가 없습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {prescription.prescribedDrugs.map((d) => (
                <li
                  key={`${d.slot}-${d.id}`}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold text-gray-400">#{d.slot}</span>
                    <span className="text-sm font-medium text-gray-800">{d.name}</span>
                  </div>
                  <Badge color={d.isSelfPay ? 'orange' : 'blue'}>
                    {d.isSelfPay ? '자가부담' : '보험'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {prescription.insuranceCodes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {prescription.insuranceCodes.map((c) => (
                <Badge key={c} color="gray">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="지표 변화" icon={<Activity size={14} />}>
          <MetricsBlock prescription={prescription} metricDefs={patientMetricDefs} />
        </Section>

        {comorbEntries.length > 0 && (
          <Section title="공병증 반응" icon={<MessageCircle size={14} />}>
            <ul className="space-y-1.5">
              {comorbEntries.map(([name, entry]) => (
                <li
                  key={name}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    entry.type === 'good'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                      : 'border-amber-100 bg-amber-50 text-amber-800'
                  }`}
                >
                  <div className="mb-0.5 font-semibold">
                    {entry.type === 'good' ? '✅' : '⚠️'} {name}
                  </div>
                  <div className="text-gray-700">"{entry.msg}"</div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="부작용" icon={<AlertTriangle size={14} />}>
          {hasSideEffects ? (
            <ul className="space-y-1">
              {prescription.sideEffects.map((s, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700">없음 ✅</p>
          )}
        </Section>

        <Section title="보험 검토" icon={<ShieldCheck size={14} />}>
          {hasDeductions ? (
            <ul className="space-y-1">
              {prescription.deductionReasons.map((r, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  ❌ {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-700">삭감 없음 ✅</p>
          )}
        </Section>

        <Section title="환자 피드백" icon={<MessageCircle size={14} />}>
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
            "{prescription.patientFeedback}"
          </p>
          {prescription.isPackagingBonus && (
            <p className="mt-1 text-[11px] text-indigo-500">병포장 보너스 적용</p>
          )}
          {prescription.isPoorAdherence && (
            <p className="mt-1 text-[11px] text-red-500">순응도 나쁨 — 혈당 상승</p>
          )}
        </Section>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white px-4 pt-3 pb-safe">
        <button
          type="button"
          onClick={resetToLogin}
          className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          처음으로
        </button>
        <button
          type="button"
          onClick={resetToSelect}
          className="flex-[2] rounded-lg bg-indigo-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
        >
          다른 환자 진료 →
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function MetricsBlock({
  prescription,
  metricDefs,
}: {
  prescription: Prescription;
  metricDefs: PatientMetricDef[];
}) {
  const customDefs = metricDefs.filter((d) => !d.isBuiltIn && d.enabled);

  return (
    <div className="space-y-1.5">
      <MetricRow
        label="HbA1c"
        unit="%"
        oldValue={prescription.oldHba1c}
        newValue={prescription.newHba1c}
        better="down"
        digits={1}
      />
      <MetricRow
        label="체중"
        unit="kg"
        oldValue={prescription.oldWeight}
        newValue={prescription.newWeight}
        better="down"
        digits={1}
      />
      <MetricRow
        label="LVEF"
        unit="%"
        oldValue={prescription.oldLvef}
        newValue={prescription.newLvef}
        better="up"
        digits={1}
      />
      <MetricRow
        label="BNP"
        unit="pg/mL"
        oldValue={prescription.oldBnp}
        newValue={prescription.newBnp}
        better="down"
        digits={1}
      />
      <MetricRow
        label="NT-proBNP"
        unit="pg/mL"
        oldValue={prescription.oldNtprobnp}
        newValue={prescription.newNtprobnp}
        better="down"
        digits={1}
      />
      <MetricRow
        label="eGFR"
        unit="ml/min/1.73m²"
        oldValue={prescription.oldEgfr}
        newValue={prescription.newEgfr}
        better="up"
        digits={1}
      />
      <MetricRow
        label="UACR"
        unit="mg/g"
        oldValue={prescription.oldUacr}
        newValue={prescription.newUacr}
        better="down"
        digits={1}
      />
      {customDefs.map((def) => {
        const oldVal = prescription.oldCustomMetrics?.[def.id];
        const newVal = prescription.newCustomMetrics?.[def.id];
        return (
          <MetricRow
            key={def.id}
            label={def.label}
            unit={def.unit}
            oldValue={oldVal ?? ''}
            newValue={newVal ?? ''}
            better={def.direction === 'increase_good' ? 'up' : 'down'}
            digits={1}
          />
        );
      })}
    </div>
  );
}
