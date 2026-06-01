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

  it('상위 집합 허용 조합: [메트+SGLT2i+DPP4i] 등록 시 부분 집합 [SGLT2i+DPP4i] 삭감 규칙 면제', () => {
    const rules: DeductionRule[] = [
      { id: 'r1', name: 'SGLT2i+DPP4i 금지', classIds: ['dc_sglt2', 'dc_dpp4'], message: 'SGLT2i+DPP4i 병용 삭감!', enabled: true },
    ];
    const allow: AllowedCombination[] = [
      { id: 'ac1', name: '3제 허용', classIds: ['dc_met', 'dc_sglt2', 'dc_dpp4'], note: '' },
    ];
    // 메트(m_2) + SGLT-2i(m_8) + DPP-4i(m_3) 함께 처방 → 허용 조합 전체 포함
    const res = checkDeductions([med('m_2'), med('m_8'), med('m_3')], [], 7.0, rules, allow, settings);
    expect(res).not.toContain('SGLT2i+DPP4i 병용 삭감!');
  });

  it('허용 조합 없으면 [SGLT2i+DPP4i] 삭감 규칙은 그대로 발동', () => {
    const rules: DeductionRule[] = [
      { id: 'r1', name: 'SGLT2i+DPP4i 금지', classIds: ['dc_sglt2', 'dc_dpp4'], message: 'SGLT2i+DPP4i 병용 삭감!', enabled: true },
    ];
    const res = checkDeductions([med('m_2'), med('m_8'), med('m_3')], [], 7.0, rules, NO_ALLOW, settings);
    expect(res).toContain('SGLT2i+DPP4i 병용 삭감!');
  });

  it('처방이 허용 조합을 다 포함하지 않으면 면제 안 됨 (허용에 없는 GLP-1 RA 추가)', () => {
    const rules: DeductionRule[] = [
      { id: 'r1', name: 'SGLT2i+DPP4i 금지', classIds: ['dc_sglt2', 'dc_dpp4'], message: 'SGLT2i+DPP4i 병용 삭감!', enabled: true },
    ];
    const allow: AllowedCombination[] = [
      { id: 'ac1', name: '3제 허용', classIds: ['dc_met', 'dc_sglt2', 'dc_dpp4'], note: '' },
    ];
    // SGLT-2i(m_8) + DPP-4i(m_3) + GLP-1 RA(m_53) — 허용 조합(메트 포함 3종)을 충족하지 못함
    const res = checkDeductions([med('m_8'), med('m_3'), med('m_53')], [], 7.0, rules, allow, settings);
    expect(res).toContain('SGLT2i+DPP4i 병용 삭감!');
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

describe('checkDeductions — 추가 병용 기준 (기존 환자)', () => {
  // seed: dualTherapyThreshold 7.5(초진), addOnTherapyThreshold 7.0(기존)
  it('초진(baseline 없음): 메트+DPP-4i, HbA1c 7.2 → 초기 2제 기준(7.5) 미달 삭감', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_3')],
      ['E11'],
      7.2,
      NO_RULES,
      NO_ALLOW,
      settings,
    );
    expect(res).toContain('초기 급여 2제 병용 기준 미달 삭감!');
  });

  it('기존 환자(메트 1제 복용 중): 메트+DPP-4i로 증량, HbA1c 7.2 → 추가 병용 기준(7.0) 충족, 삭감 없음', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_3')],
      ['E11'],
      7.2,
      NO_RULES,
      NO_ALLOW,
      settings,
      1, // 직전 1제(메트) 복용 중 → 2제로 증량
    );
    expect(res.filter((r) => r.includes('삭감'))).toEqual([]);
  });

  it('기존 환자(메트 1제)에서 2제로 증량 시 HbA1c 6.8(<7.0)이면 추가 병용 기준 미달 삭감', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_3')],
      ['E11'],
      6.8,
      NO_RULES,
      NO_ALLOW,
      settings,
      1,
    );
    expect(res).toContain('추가 병용 기준 미달 삭감!');
  });
});

describe('checkDeductions — 기존 병용 유지(치료 성공) 시 삭감 안 함', () => {
  it('이미 2제(메트+DPP-4i) 복용 중 → 같은 2제 유지, HbA1c 6.3으로 정상화돼도 삭감 없음', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_3')],
      ['E11'],
      6.3,
      NO_RULES,
      NO_ALLOW,
      settings,
      2, // 직전에도 2제 병용 중 → 증량 아님(유지)
    );
    expect(res.filter((r) => r.includes('삭감'))).toEqual([]);
  });

  it('이미 2제 복용 중 유지, HbA1c 6.0(<6.5)이어도 신규 처방 기준 미적용 → 삭감 없음', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_8')],
      ['E11'],
      6.0,
      NO_RULES,
      NO_ALLOW,
      settings,
      2,
    );
    expect(res.filter((r) => r.includes('삭감'))).toEqual([]);
  });

  it('초진(직전 0제)에서 동일 처방·동일 HbA1c는 신규 처방이므로 삭감 발동(대조군)', () => {
    const res = checkDeductions(
      [med('m_2'), med('m_3')],
      ['E11'],
      6.3,
      NO_RULES,
      NO_ALLOW,
      settings,
      0,
    );
    // 6.3 < 6.5 → 초기 처방 기준 삭감
    expect(res).toContain('당뇨(E11) 초기 HbA1c 6.5% 미만 처방 삭감!');
  });
});

describe('checkDeductions — 검사 제외 약제', () => {
  it('isNotDrug, isInsuranceException, 슬롯 4-5는 호출자가 거른다 (입력에 없으면 검사 안 함)', () => {
    // 빈 입력
    const res = checkDeductions([], ['E11'], 6.0, NO_RULES, NO_ALLOW, settings);
    expect(res).toEqual([]);
  });
});
