import { describe, it, expect } from 'vitest';
import { seedMedications, seedSettings } from '../src/data/seed';
import { checkNonDmCoverage } from '../src/lib/nonDmCoverage';
import type { Medication, Patient } from '../src/types';

const meds = seedMedications;
const settings = seedSettings;

function med(id: string): Medication {
  const m = meds.find((x) => x.id === id);
  if (!m) throw new Error(`med ${id} not found`);
  return m;
}

const basePatient: Patient = {
  id: 'pTest',
  name: '테스트',
  age: 60,
  gender: 'M',
  weight: 70,
  bmi: 24,
  initialHba1c: 6.0, // 비당뇨
  type: '초진',
  desc: '',
  comorbidities: [],
  adherence: '좋음',
  order: 999,
  lvef: 0,
  nyha: 0,
  bnp: 0,
  ntprobnp: 0,
  hfHospitalization: false,
  echoAbnormal: false,
  hfStandardTx: false,
  egfr: 0,
  uacr: 0,
  dipstick: false,
  ckdStandardTx: false,
  prevDrugs: ['', '', '', '', ''],
  prevTreatment: '',
  imageUrl: '',
};

function patient(overrides: Partial<Patient>): Patient {
  return { ...basePatient, ...overrides };
}

describe('checkNonDmCoverage — 비대상', () => {
  it('당뇨 환자(initialHba1c >= 6.5)는 검사 비대상', () => {
    const p = patient({ initialHba1c: 7.0 });
    const res = checkNonDmCoverage(p, med('m_8'), settings);
    expect(res.notApplicable).toBe(true);
    expect(res.covered).toBe(true);
  });

  it('SGLT-2i 아닌 약제는 검사 비대상', () => {
    const p = patient({ initialHba1c: 6.0 });
    const res = checkNonDmCoverage(p, med('m_2'), settings); // 메트포르민
    expect(res.notApplicable).toBe(true);
  });
});

describe('checkNonDmCoverage — HFrEF 특례 (LVEF < 40)', () => {
  const passing = patient({
    initialHba1c: 6.0,
    lvef: 30,
    nyha: 3,
    bnp: 100,
    hfStandardTx: true,
    hfHospitalization: true,
  });

  it('통과: LVEF 30, NYHA 3, BNP 100, std=true, hosp=true (m_8 allowHFrEF)', () => {
    const res = checkNonDmCoverage(passing, med('m_8'), settings);
    expect(res.covered).toBe(true);
    expect(res.reason).toBe('HFrEF 특례 충족');
  });

  it('탈락: BNP/NTpro 둘 다 기준 미달', () => {
    const p = { ...passing, bnp: 10, ntprobnp: 10 };
    const res = checkNonDmCoverage(p, med('m_8'), settings);
    expect(res.covered).toBe(false);
  });
});

describe('checkNonDmCoverage — HFpEF 특례 (LVEF >= 40)', () => {
  // m_10 (자디앙 10mg)은 allowHFpEFCoverage=true
  const passing = patient({
    initialHba1c: 6.0,
    lvef: 45,
    nyha: 2,
    ntprobnp: 200,
    hfStandardTx: true,
    echoAbnormal: true,
  });

  it('통과: LVEF 45, NYHA 2, NTpro 200, std=true, echo=true (m_10 allowHFpEF)', () => {
    const res = checkNonDmCoverage(passing, med('m_10'), settings);
    expect(res.covered).toBe(true);
    expect(res.reason).toBe('HFpEF 특례 충족');
  });

  it('탈락: NYHA 1로 NYHA 기준 미달', () => {
    const p = { ...passing, nyha: 1 };
    const res = checkNonDmCoverage(p, med('m_10'), settings);
    expect(res.covered).toBe(false);
  });

  it('탈락: 약제가 HFpEF 미허용 (m_8) — m_8은 allowHFpEFCoverage=false', () => {
    const res = checkNonDmCoverage(passing, med('m_8'), settings);
    expect(res.covered).toBe(false);
  });
});

describe('checkNonDmCoverage — CKD 특례', () => {
  const passing = patient({
    initialHba1c: 6.0,
    egfr: 40,
    uacr: 300,
    dipstick: true,
    ckdStandardTx: true,
  });

  it('통과: eGFR 40, UACR 300, dipstick=true, std=true (m_8 allowCkd)', () => {
    const res = checkNonDmCoverage(passing, med('m_8'), settings);
    expect(res.covered).toBe(true);
    expect(res.reason).toBe('CKD 특례 충족');
  });

  it('탈락: UACR 100으로 ckdUacrMin 미달', () => {
    const p = { ...passing, uacr: 100 };
    const res = checkNonDmCoverage(p, med('m_8'), settings);
    expect(res.covered).toBe(false);
  });

  it('탈락: dipstick=false', () => {
    const p = { ...passing, dipstick: false };
    const res = checkNonDmCoverage(p, med('m_8'), settings);
    expect(res.covered).toBe(false);
  });
});
