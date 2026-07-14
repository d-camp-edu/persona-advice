import { describe, it, expect } from 'vitest';
import { seedSettings } from '../src/data/seed';
import { checkNonDmCoverage } from '../src/lib/nonDmCoverage';
import type { Medication, Patient } from '../src/types';

const settings = seedSettings;

// 특례 플래그 조합을 명시적으로 만들기 위해 합성 약제를 쓴다(시드 수치 독립).
const baseMed: Medication = {
  id: 'mx', name: '테스트약', categoryId: 'cat_single', pkg: 'ptp', classes: [],
  isNotDrug: false,
  effect: 0.8, effectWeight: 0, effectLvef: 0, effectBnp: 0, effectNtprobnp: 0,
  effectEgfr: 0, effectEgfrDip: 0, effectUacr: 0,
  beneficialComorb: [], worseningComorb: [],
  sideEffectProb: 0, sideEffectPenalty: 0, sideEffectMsg: '',
  egfrLimit: 0, allowHFrEFCoverage: false, allowHFpEFCoverage: false, allowCkdCoverage: false,
  isInsuranceException: false, allow2TQD: false, order: 1,
};

function sglt2(flags: Partial<Medication> = {}): Medication {
  return { ...baseMed, classes: ['dc_sglt2'], ...flags };
}
const metformin: Medication = { ...baseMed, classes: ['dc_met'] };
/** HFrEF+HFpEF+CKD 특례 모두 보유(현행 엑셀 SGLT-2i 전형) */
const sglt2All = sglt2({ allowHFrEFCoverage: true, allowHFpEFCoverage: true, allowCkdCoverage: true });

const basePatient: Patient = {
  id: 'pTest', name: '테스트', age: 60, gender: 'M', weight: 70, bmi: 24,
  initialHba1c: 6.0, type: '초진', desc: '', comorbidities: [], adherence: '좋음', order: 999,
  lvef: 0, nyha: 0, bnp: 0, ntprobnp: 0,
  hfHospitalization: false, echoAbnormal: false, hfStandardTx: false,
  egfr: 0, uacr: 0, dipstick: false, ckdStandardTx: false,
  prevDrugs: ['', '', '', '', ''], prevTreatment: '', imageUrl: '',
};

function patient(overrides: Partial<Patient>): Patient {
  return { ...basePatient, ...overrides };
}

describe('checkNonDmCoverage — 비대상', () => {
  it('당뇨 환자(initialHba1c >= 6.5)는 검사 비대상', () => {
    const p = patient({ initialHba1c: 7.0 });
    const res = checkNonDmCoverage(p, sglt2All, settings);
    expect(res.notApplicable).toBe(true);
    expect(res.covered).toBe(true);
  });

  it('SGLT-2i 아닌 약제는 검사 비대상', () => {
    const p = patient({ initialHba1c: 6.0 });
    const res = checkNonDmCoverage(p, metformin, settings);
    expect(res.notApplicable).toBe(true);
  });
});

describe('checkNonDmCoverage — HFrEF 특례 (LVEF < 40)', () => {
  const passing = patient({
    initialHba1c: 6.0, lvef: 30, nyha: 3, bnp: 100, hfStandardTx: true, hfHospitalization: true,
  });

  it('통과: LVEF 30, NYHA 3, BNP 100, std=true, hosp=true (allowHFrEF)', () => {
    const res = checkNonDmCoverage(passing, sglt2({ allowHFrEFCoverage: true }), settings);
    expect(res.covered).toBe(true);
    expect(res.reason).toBe('HFrEF 특례 충족');
  });

  it('탈락: BNP/NTpro 둘 다 기준 미달', () => {
    const p = { ...passing, bnp: 10, ntprobnp: 10 };
    const res = checkNonDmCoverage(p, sglt2({ allowHFrEFCoverage: true }), settings);
    expect(res.covered).toBe(false);
  });
});

describe('checkNonDmCoverage — HFpEF 특례 (LVEF >= 40)', () => {
  const passing = patient({
    initialHba1c: 6.0, lvef: 45, nyha: 2, ntprobnp: 200, hfStandardTx: true, echoAbnormal: true,
  });

  it('통과: LVEF 45, NYHA 2, NTpro 200, std=true, echo=true (allowHFpEF)', () => {
    const res = checkNonDmCoverage(passing, sglt2({ allowHFpEFCoverage: true }), settings);
    expect(res.covered).toBe(true);
    expect(res.reason).toBe('HFpEF 특례 충족');
  });

  it('탈락: NYHA 1로 NYHA 기준 미달', () => {
    const p = { ...passing, nyha: 1 };
    const res = checkNonDmCoverage(p, sglt2({ allowHFpEFCoverage: true }), settings);
    expect(res.covered).toBe(false);
  });

  it('탈락: 약제가 HFpEF 미허용', () => {
    const res = checkNonDmCoverage(passing, sglt2({ allowHFpEFCoverage: false }), settings);
    expect(res.covered).toBe(false);
  });
});

describe('checkNonDmCoverage — CKD 특례', () => {
  const passing = patient({
    initialHba1c: 6.0, egfr: 40, uacr: 300, dipstick: true, ckdStandardTx: true,
  });

  it('통과: eGFR 40, UACR 300, dipstick=true, std=true (allowCkd)', () => {
    const res = checkNonDmCoverage(passing, sglt2({ allowCkdCoverage: true }), settings);
    expect(res.covered).toBe(true);
    expect(res.reason).toBe('CKD 특례 충족');
  });

  it('탈락: UACR 100으로 ckdUacrMin 미달', () => {
    const p = { ...passing, uacr: 100 };
    const res = checkNonDmCoverage(p, sglt2({ allowCkdCoverage: true }), settings);
    expect(res.covered).toBe(false);
  });

  it('탈락: dipstick=false', () => {
    const p = { ...passing, dipstick: false };
    const res = checkNonDmCoverage(p, sglt2({ allowCkdCoverage: true }), settings);
    expect(res.covered).toBe(false);
  });
});
