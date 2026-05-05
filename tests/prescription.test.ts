import { describe, it, expect } from 'vitest';
import {
  seedMedications,
  seedPatients,
  seedSettings,
} from '../src/data/seed';
import { getPatientCurrentState } from '../src/lib/patientState';
import { calculatePrescription } from '../src/lib/prescription';
import type { Medication } from '../src/types';

const meds = seedMedications;
const settings = seedSettings;

const fixedNow = () => new Date('2026-05-04T00:00:00.000Z');
const noSideEffectRng = () => 1.0;
const alwaysSideEffectRng = () => 0.0;

function patient(id: string) {
  const p = seedPatients.find((x) => x.id === id);
  if (!p) throw new Error(`patient ${id} not found in seed`);
  return p;
}

function med(id: string): Medication {
  const m = meds.find((x) => x.id === id);
  if (!m) throw new Error(`med ${id} not found in seed`);
  return m;
}

function emptySlots(): (Medication | null)[] {
  return [null, null, null, null, null];
}

function slotsWith(...ms: Medication[]): (Medication | null)[] {
  const arr = emptySlots();
  ms.forEach((m, i) => {
    arr[i] = m;
  });
  return arr;
}

describe('getPatientCurrentState', () => {
  it('재진 환자는 prevDrugs가 있어도 initialHba1c를 그대로 사용한다 (§5-1 literal)', () => {
    const p = patient('p2'); // 재진, initialHba1c 6.8, prevDrugs ['m_1' (effect 0.8)]
    const state = getPatientCurrentState(p, [], meds);
    expect(state.hba1c).toBe(6.8);
    expect(state.weight).toBe(p.weight);
    expect(state.lvef).toBe(p.lvef);
    expect(state.egfr).toBe(p.egfr);
  });

  it('초진 환자는 prevDrugs effect를 initialHba1c에서 차감 (실제 seed에선 prevDrugs 비어 있어 no-op)', () => {
    const p = patient('p1'); // 초진, prevDrugs all empty
    const state = getPatientCurrentState(p, [], meds);
    expect(state.hba1c).toBe(p.initialHba1c);
  });

  it('재진 환자(p18)도 prevDrugs 차감 없이 initialHba1c 그대로', () => {
    const p = patient('p18'); // 재진, prevDrugs ['m_8','m_1']
    const state = getPatientCurrentState(p, [], meds);
    expect(state.hba1c).toBe(7.6);
  });

  it('이전 처방 이력이 있으면 마지막 처방의 newHba1c를 그대로 사용', () => {
    const p = patient('p2');
    const fake = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(med('m_2')),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    const state = getPatientCurrentState(p, [fake.prescription], meds);
    expect(state.hba1c).toBe(fake.prescription.newHba1c);
    expect(state.weight).toBe(fake.prescription.newWeight);
  });
});

describe('calculatePrescription — 단일 약제 결정성', () => {
  it('rng=1.0이면 부작용은 절대 발생하지 않는다 (sideEffectProb<100 가정)', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(med('m_2')), // sideEffectProb 20
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toEqual([]);
    expect(result.prescription.newHba1c).toBeCloseTo(7.8 - 1.2, 5);
  });

  it('rng=0.0이고 sideEffectProb>0이면 부작용 발생 + eH 차감', () => {
    const p = patient('p1');
    const m = med('m_2'); // effect 1.2, penalty 0.4
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(m),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: alwaysSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toHaveLength(1);
    expect(result.prescription.sideEffects[0]).toContain(m.name);
    expect(result.prescription.newHba1c).toBeCloseTo(7.8 - (1.2 - 0.4), 5);
    expect(result.prescription.patientFeedback).toBe(settings.msgSideEffect);
    expect(Object.keys(result.prescription.comorbFeedback)).toHaveLength(0);
  });
});

describe('calculatePrescription — 부작용 면제', () => {
  it('과거 위장장애 부작용 2회 이상이면 위장장애 약제 부작용 스킵', () => {
    const p = patient('p1');
    const m = med('m_2'); // worseningComorb includes 위장장애
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(m),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: { 위장장애: 2 },
      rng: alwaysSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toEqual([]);
    expect(result.prescription.newHba1c).toBeCloseTo(7.8 - 1.2, 5);
  });

  it('sideEffectExemptions 조합이 활성 계열에 포함되면 부작용 스킵', () => {
    const p = patient('p1');
    const m = med('m_2');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(m),
      diagCodes: ['E11'],
      settings,
      exemptions: [
        { id: 'ex1', name: '메트포르민 면제', classIds: ['dc_met'], note: '' },
      ],
      pastSideEffectCounts: {},
      rng: alwaysSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toEqual([]);
  });
});

describe('calculatePrescription — 병포장 보너스', () => {
  it('선택 약제(비약물 제외) 모두 pkg=bottle이면 HbA1c +packagingBonusEffect', () => {
    const p = patient('p1');
    const m = med('m_27'); // pkg='bottle', effect 1.5
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(m),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.isPackagingBonus).toBe(true);
    expect(result.prescription.newHba1c).toBeCloseTo(
      7.8 - (1.5 + settings.packagingBonusEffect),
      5,
    );
    expect(result.prescription.patientFeedback).toBe(settings.msgPackaging);
  });

  it('한 약제라도 비병포장이면 보너스 없음', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(med('m_27'), med('m_2')), // bottle + ptp
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.isPackagingBonus).toBe(false);
  });
});

describe('calculatePrescription — 순응도 나쁨', () => {
  it('adherence=나쁨 + 비병포장 + 약물 처방 → totals.h = -0.4 (HbA1c 상승)', () => {
    const p = patient('p11'); // adherence='나쁨', initialHba1c 10.2, prevDrugs m_15(1.6)
    const m = med('m_2'); // ptp
    const start = getPatientCurrentState(p, [], meds);
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(m),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.isPoorAdherence).toBe(true);
    expect(result.prescription.newHba1c).toBeCloseTo(start.hba1c + 0.4, 5);
    expect(result.prescription.patientFeedback).toContain('약을 제대로');
  });

  it('adherence=나쁨이라도 병포장 처방이면 정상 계산', () => {
    const p = patient('p11');
    const m = med('m_27'); // bottle
    const start = getPatientCurrentState(p, [], meds);
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(m),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.isPoorAdherence).toBe(false);
    expect(result.prescription.isPackagingBonus).toBe(true);
    expect(result.prescription.newHba1c).toBeCloseTo(
      start.hba1c - (1.5 + settings.packagingBonusEffect),
      5,
    );
  });
});

describe('calculatePrescription — HbA1c 4.5 클램프', () => {
  it('총효과가 너무 커도 newHba1c는 4.5 미만으로 떨어지지 않는다', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: { ...getPatientCurrentState(p, [], meds), hba1c: 5.5 },
      slots: slotsWith(med('m_27'), med('m_30')), // 합산 effect 매우 큼
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newHba1c).toBeGreaterThanOrEqual(4.5);
    expect(result.prescription.newHba1c).toBe(4.5);
  });
});

describe('calculatePrescription — 비약물 전용 처방', () => {
  it('isNotDrug 약제만 처방하면 isLifestyleOnly + msgLifestyle', () => {
    const p = patient('p1');
    const m = med('m_60'); // 생활습관, isNotDrug
    const start = getPatientCurrentState(p, [], meds);
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(m),
      diagCodes: [],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newHba1c).toBe(start.hba1c);
    expect(result.prescription.newWeight).toBeCloseTo(start.weight - 1, 5);
    expect(result.prescription.patientFeedback).toBe(settings.msgLifestyle);
    expect(result.prescription.isPoorAdherence).toBe(false);
    expect(result.prescription.isPackagingBonus).toBe(false);
  });
});

describe('calculatePrescription — 빈 지표 처리 (5-3)', () => {
  it('current 지표가 0이면 newXxx는 ""로 반환', () => {
    const p = patient('p1'); // lvef/nyha/bnp/ntprobnp 모두 0
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(med('m_27')), // SGLT-2i 복합제 → effectLvef/effectNtprobnp 등 있음
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newLvef).toBe('');
    expect(result.prescription.newNyha).toBe('');
    expect(result.prescription.newBnp).toBe('');
    expect(result.prescription.newNtprobnp).toBe('');
  });

  it('current 지표가 0이 아니면 newXxx는 효과를 더한 숫자', () => {
    const p = patient('p2'); // lvef 35, ntprobnp 150
    const start = getPatientCurrentState(p, [], meds);
    const m = med('m_27'); // effectLvef +2, effectNtprobnp -130
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(m),
      diagCodes: ['E11', 'I50'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newLvef).toBe(start.lvef + 2);
    expect(result.prescription.newNtprobnp).toBe(start.ntprobnp - 130);
  });
});

describe('calculatePrescription — 공병증 메시지', () => {
  it('호전 공병증 일치 시 good 엔트리 생성', () => {
    const p = patient('p1'); // comorbidities ['비만']
    const m = med('m_2'); // beneficialComorb ['비만','MASH']
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(m),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.comorbFeedback['비만']).toBeDefined();
    expect(result.prescription.comorbFeedback['비만'].type).toBe('good');
  });

  it('부작용 발생 시 공병증 메시지는 표시하지 않는다', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(med('m_2')),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: alwaysSideEffectRng,
      now: fixedNow,
    });
    expect(Object.keys(result.prescription.comorbFeedback)).toHaveLength(0);
  });
});

describe('p2 + m_30 (계획.md M5 마일스톤 시나리오)', () => {
  it('A안 적용 후: 6.8(base 그대로) → m_30(1.8)+병포장(0.3)=2.1 차감 → 4.7', () => {
    const p = patient('p2');
    const start = getPatientCurrentState(p, [], meds);
    expect(start.hba1c).toBe(6.8); // §5-1 literal: 재진은 prevDrugs 차감 없이 initialHba1c

    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(med('m_30')),
      diagCodes: ['E11', 'I50'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    // 기획.md §3-4 예시는 5.6이지만 표(§4-7)의 m_30.effect=1.8 + 병포장 보너스 0.3로
    // 산술 결과는 4.7. 5.6은 illustrative 수치로 간주.
    expect(result.prescription.newHba1c).toBeCloseTo(4.7, 5);
    expect(result.prescription.isPackagingBonus).toBe(true);
  });
});
