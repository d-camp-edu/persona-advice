import type { CurrentState, Medication, Patient, Prescription } from '../types';

/**
 * 같은 시연 세션 내 이전 처방이 있으면 마지막 처방 결과를 현재 상태로 사용한다.
 *
 * 이전 처방이 없는 경우 (기획.md §5-1):
 * - 초진 환자만 prevDrugs effect를 initialHba1c에서 차감해 baseline을 만든다.
 *   (실제 seed에서 초진은 prevDrugs가 모두 비어 있어 사실상 no-op이며,
 *    초진 외 type에 대해서는 initialHba1c가 이미 prevDrugs 복용 중인 현재 상태로 정의된다.)
 * - 재진/리핏 환자는 initialHba1c를 그대로 현재 HbA1c로 사용한다.
 */
export function getPatientCurrentState(
  patient: Patient,
  sessionPrescriptions: Prescription[],
  meds: Medication[],
): CurrentState {
  const last = lastPrescriptionForPatient(sessionPrescriptions, patient.id);
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
