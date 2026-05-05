import type { GlobalSettings, Medication, Patient } from '../types';

const NON_DM_THRESHOLD = 6.5;

export interface NonDmCoverageResult {
  /** true면 보험 적용 가능, false면 자가부담. */
  covered: boolean;
  /** 미적용 사유 또는 적용 근거 */
  reason: string;
  /** 검사 자체가 비대상이면(예: 당뇨환자, 비-SGLT2i) true. covered=true와 함께 반환. */
  notApplicable: boolean;
}

/**
 * 비당뇨 환자에게 SGLT-2i를 처방했을 때 보험 적용 가능 여부.
 * 기획.md §7. 환자 initialHba1c >= 6.5이거나 약제가 SGLT-2i가 아니면 검사 비대상.
 *
 * HFrEF/HFpEF/CKD 중 하나의 특례라도 충족하면 covered=true.
 */
export function checkNonDmCoverage(
  patient: Patient,
  slot: Medication,
  settings: GlobalSettings,
): NonDmCoverageResult {
  const isNonDm = patient.initialHba1c < NON_DM_THRESHOLD;
  const isSglt2 = slot.classes.includes('dc_sglt2');
  if (!isNonDm || !isSglt2) {
    return { covered: true, reason: '', notApplicable: true };
  }

  const hfChecklist =
    patient.nyha >= settings.hfNyhaMin &&
    (patient.bnp >= settings.hfBnpMin || patient.ntprobnp >= settings.hfNtprobnpMin) &&
    patient.hfStandardTx &&
    (patient.hfHospitalization || patient.echoAbnormal);

  if (slot.allowHFrEFCoverage && patient.lvef > 0 && patient.lvef < settings.hfLvefMax && hfChecklist) {
    return { covered: true, reason: 'HFrEF 특례 충족', notApplicable: false };
  }
  if (slot.allowHFpEFCoverage && patient.lvef >= settings.hfLvefMax && hfChecklist) {
    return { covered: true, reason: 'HFpEF 특례 충족', notApplicable: false };
  }
  if (
    slot.allowCkdCoverage &&
    patient.egfr >= settings.ckdEgfrMin &&
    patient.egfr <= settings.ckdEgfrMax &&
    patient.uacr >= settings.ckdUacrMin &&
    patient.dipstick &&
    patient.ckdStandardTx
  ) {
    return { covered: true, reason: 'CKD 특례 충족', notApplicable: false };
  }

  return {
    covered: false,
    reason: '비당뇨 SGLT-2i 특례 미충족 — 자가부담',
    notApplicable: false,
  };
}
