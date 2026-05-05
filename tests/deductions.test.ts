import { describe, it, expect } from 'vitest';
import { seedMedications, seedSettings } from '../src/data/seed';
import { checkDeductions } from '../src/lib/deductions';
import type { AllowedCombination, DeductionRule, Medication } from '../src/types';

const meds = seedMedications;
const settings = seedSettings;

function med(id: string): Medication {
  const m = meds.find((x) => x.id === id);
  if (!m) throw new Error(`med ${id} not found`);
  return m;
}

const NO_RULES: DeductionRule[] = [];
const NO_ALLOW: AllowedCombination[] = [];

describe('checkDeductions — DPP-4i + GLP-1 RA 병용 금지', () => {
  it('단독 처방으론 삭감 없음', () => {
    const res = checkDeductions([med('m_3')], [], 7.0, NO_RULES, NO_ALLOW, settings);
    expect(res).not.toContain('DPP-4i와 GLP-1 RA 병용 삭감!');
  });

  it('DPP-4i (m_3) + GLP-1 RA (m_53) 함께 처방하면 삭감', () => {
    const res = checkDeductions(
      [med('m_3'), med('m_53')],
      [],
      7.0,
      NO_RULES,
      NO_ALLOW,
      settings,
    );
    expect(res).toContain('DPP-4i와 GLP-1 RA 병용 삭감!');
  });

  it('AllowedCombination에 등록되면 병용 삭감 면제', () => {
    const allow: AllowedCombination[] = [
      { id: 'ac1', name: '예외', classIds: ['dc_dpp4', 'dc_glp1'], note: '' },
    ];
    const res = checkDeductions(
      [med('m_3'), med('m_53')],
      [],
      7.0,
      NO_RULES,
      allow,
      settings,
    );
    expect(res).not.toContain('DPP-4i와 GLP-1 RA 병용 삭감!');
  });
});

describe('checkDeductions — E11 4규칙', () => {
  it('규칙 A: HbA1c < 6.5%면 삭감', () => {
    const res = checkDeductions([med('m_2')], ['E11'], 6.0, NO_RULES, NO_ALLOW, settings);
    expect(res).toContain('당뇨(E11) 초기 HbA1c 6.5% 미만 처방 삭감!');
  });

  it('규칙 B: HbA1c >= 6.5% + 단일계열 + 메트포르민 미포함 → 삭감 (DPP-4i 단독)', () => {
    const res = checkDeductions([med('m_3')], ['E11'], 7.0, NO_RULES, NO_ALLOW, settings);
    expect(res).toContain('1차 메트포르민 미사용 삭감!');
  });

  it('규칙 C: 2제 + HbA1c < 7.5% (메트+DPP-4i, HbA1c 7.0)', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_3')],
      ['E11'],
      7.0,
      NO_RULES,
      NO_ALLOW,
      settings,
    );
    expect(res).toContain('초기 급여 2제 병용 기준 미달 삭감!');
  });

  it('규칙 D: 2제 + HbA1c >= 7.5% + 메트포르민 미포함 → 삭감 (DPP-4i + SGLT-2i)', () => {
    const res = checkDeductions(
      [med('m_3'), med('m_8')],
      ['E11'],
      8.0,
      NO_RULES,
      NO_ALLOW,
      settings,
    );
    expect(res).toContain('병용 요법 1차약제 미포함 삭감!');
  });

  it('정상: 메트포르민 + SGLT-2i, HbA1c 8.0 → E11 삭감 없음', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_8')],
      ['E11'],
      8.0,
      NO_RULES,
      NO_ALLOW,
      settings,
    );
    expect(res.filter((r) => r.includes('삭감'))).toEqual([]);
  });
});

describe('checkDeductions — 검사 제외 약제', () => {
  it('isNotDrug, isInsuranceException, 슬롯 4-5는 호출자가 거른다 (입력에 없으면 검사 안 함)', () => {
    // 빈 입력
    const res = checkDeductions([], ['E11'], 6.0, NO_RULES, NO_ALLOW, settings);
    expect(res).toEqual([]);
  });
});
