import type { CurrentState, Medication, Patient, PatientMetricDef, Prescription } from '../types';

export function getPatientCurrentState(
  patient: Patient,
  sessionPrescriptions: Prescription[],
  meds: Medication[],
  metricDefs: PatientMetricDef[] = [],
): CurrentState {
  const last = lastPrescriptionForPatient(sessionPrescriptions, patient.id);

  const customDefs = metricDefs.filter((d) => !d.isBuiltIn && d.enabled);
  const customMetrics: Record<string, number> = {};
  for (const def of customDefs) {
    if (last) {
      const v = last.newCustomMetrics?.[def.id];
      customMetrics[def.id] = typeof v === 'number' ? v : (patient.customMetrics?.[def.id] ?? 0);
    } else {
      customMetrics[def.id] = patient.customMetrics?.[def.id] ?? 0;
    }
  }

  if (last) {
    return {
      hba1c: last.newHba1c,
      weight: last.newWeight,
      lvef: numericOr(last.newLvef, patient.lvef),
      nyha: numericOr(last.newNyha, patient.nyha),
      bnp: numericOr(last.newBnp, patient.bnp),
      ntprobnp: numericOr(last.newNtprobnp, patient.ntprobnp),
      egfr: numericOr(last.newEgfr, patient.egfr),
      uacr: numericOr(last.newUacr, patient.uacr),
      customMetrics,
    };
  }

  let baselineHba1c = patient.initialHba1c;
  if (patient.type === '초진') {
    const prevEffectSum = patient.prevDrugs
      .filter((id) => id && id.length > 0)
      .map((id) => meds.find((m) => m.id === id))
      .reduce((sum, m) => sum + (m?.effect ?? 0), 0);
    baselineHba1c = roundHba1c(patient.initialHba1c - prevEffectSum);
  }

  return {
    hba1c: baselineHba1c,
    weight: patient.weight,
    lvef: patient.lvef,
    nyha: patient.nyha,
    bnp: patient.bnp,
    ntprobnp: patient.ntprobnp,
    egfr: patient.egfr,
    uacr: patient.uacr,
    customMetrics,
  };
}

function lastPrescriptionForPatient(
  prescriptions: Prescription[],
  patientId: string,
): Prescription | undefined {
  for (let i = prescriptions.length - 1; i >= 0; i -= 1) {
    if (prescriptions[i].patientId === patientId) return prescriptions[i];
  }
  return undefined;
}

function numericOr(value: number | '', fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function roundHba1c(v: number): number {
  return Math.round(v * 10) / 10;
}
