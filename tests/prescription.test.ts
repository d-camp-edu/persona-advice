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

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ── 시드 수치 변화에 견고하도록 약제는 "특성"으로 고른다 ──────────────────
/** 경구 PTP 단일 약제(부작용 확률 0<p<100, 강하 효과 있음) */
const ptpDrug = meds.find(
  (m) => !m.isNotDrug && m.pkg === 'ptp' && m.effect > 0 && m.sideEffectProb > 0 && m.sideEffectProb < 100,
)!;
/** 병포장 약제(강하 효과 있음) */
const bottleDrug = meds.find((m) => !m.isNotDrug && m.pkg === 'bottle' && m.effect > 0)!;
/** worseningComorb에 위장장애를 가진 약제(PTP, 부작용 확률>0) */
const giDrug = meds.find(
  (m) => !m.isNotDrug && m.pkg === 'ptp' && m.worseningComorb.includes('위장장애') && m.sideEffectProb > 0,
)!;
/** dc_met 계열 약제(면제 조합 테스트용) */
const metDrug = meds.find((m) => m.classes.includes('dc_met'))!;
/** 비약물(생활습관) */
const lifestyle = meds.find((m) => m.isNotDrug)!;
/** SGLT-2i 심부전 지표(effectLvef 또는 effectNtprobnp≠0)를 움직이는 약제 */
const hfDrug = meds.find(
  (m) => m.classes.includes('dc_sglt2') && (m.effectLvef !== 0 || m.effectNtprobnp !== 0),
)!;
/** 비만 호전 약제 */
const obesityDrug = meds.find((m) => !m.isNotDrug && m.beneficialComorb.includes('비만'))!;
/** eGFR 이니셜딥을 가진 단일계열 SGLT-2i */
const dipDrug = meds.find(
  (m) => m.classes.length === 1 && m.classes[0] === 'dc_sglt2' && m.effectEgfrDip !== 0,
)!;
/** BID 테스트용: 경구 PTP·강하효과·체중효과·부작용 확률 모두 있는 약제 */
const bidDrug = meds.find(
  (m) =>
    !m.isNotDrug &&
    m.pkg === 'ptp' &&
    m.effect > 0 &&
    m.effectWeight !== 0 &&
    m.sideEffectProb > 0 &&
    m.sideEffectProb < 100,
)!;

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
    const p = patient('p2'); // 재진, initialHba1c 6.8
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
    const p = patient('p18'); // 재진
    const state = getPatientCurrentState(p, [], meds);
    expect(state.hba1c).toBe(7.6);
  });

  it('이전 처방 이력이 있으면 마지막 처방의 newHba1c를 그대로 사용', () => {
    const p = patient('p2');
    const fake = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(ptpDrug),
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
  it('rng=1.0이면 부작용은 절대 발생하지 않는다', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(ptpDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toEqual([]);
    expect(result.prescription.newHba1c).toBeCloseTo(7.8 - ptpDrug.effect, 5);
  });

  it('rng=0.0이고 sideEffectProb>0이면 부작용 발생 + eH 차감', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(ptpDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: alwaysSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toHaveLength(1);
    expect(result.prescription.sideEffects[0]).toContain(ptpDrug.name);
    expect(result.prescription.newHba1c).toBeCloseTo(7.8 - (ptpDrug.effect - ptpDrug.sideEffectPenalty), 5);
    expect(result.prescription.patientFeedback).toBe(settings.msgSideEffect);
  });
});

describe('calculatePrescription — BID(1일 2회)', () => {
  it('bidFlags가 true인 슬롯은 효과가 2배로 적용된다', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(bidDrug),
      bidFlags: [true, false, false, false, false],
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newHba1c).toBeCloseTo(round1(7.8 - bidDrug.effect * 2), 5);
    expect(result.prescription.newWeight).toBeCloseTo(
      round1(result.prescription.oldWeight + bidDrug.effectWeight * 2),
      5,
    );
    expect(result.prescription.prescribedDrugs[0].bid).toBe(true);
  });

  it('BID여도 부작용 페널티는 1회분만 차감된다', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(bidDrug),
      bidFlags: [true, false, false, false, false],
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: alwaysSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toHaveLength(1);
    expect(result.prescription.newHba1c).toBeCloseTo(
      round1(7.8 - (bidDrug.effect * 2 - bidDrug.sideEffectPenalty)),
      5,
    );
  });

  it('bidFlags 미지정이면 QD(1배)로 계산 — 기존 동작 유지', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(bidDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newHba1c).toBeCloseTo(round1(7.8 - bidDrug.effect), 5);
    expect(result.prescription.prescribedDrugs[0].bid).toBe(false);
  });
});

describe('calculatePrescription — 부작용 면제', () => {
  it('과거 위장장애 부작용 2회 이상이면 위장장애 약제 부작용 스킵', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(giDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: { 위장장애: 2 },
      rng: alwaysSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.sideEffects).toEqual([]);
    expect(result.prescription.newHba1c).toBeCloseTo(7.8 - giDrug.effect, 5);
  });

  it('sideEffectExemptions 조합이 활성 계열에 포함되면 부작용 스킵', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(metDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [{ id: 'ex1', name: '메트포르민 면제', classIds: ['dc_met'], note: '' }],
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
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(bottleDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.isPackagingBonus).toBe(true);
    expect(result.prescription.newHba1c).toBeCloseTo(
      round1(7.8 - (bottleDrug.effect + settings.packagingBonusEffect)),
      5,
    );
    expect(result.prescription.patientFeedback).toBe(settings.msgPackaging);
  });

  it('한 약제라도 비병포장이면 보너스 없음', () => {
    const p = patient('p1');
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(bottleDrug, ptpDrug), // bottle + ptp
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
    const p = patient('p11'); // adherence='나쁨'
    const start = getPatientCurrentState(p, [], meds);
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(ptpDrug),
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
    const start = getPatientCurrentState(p, [], meds);
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(bottleDrug),
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
      round1(start.hba1c - (bottleDrug.effect + settings.packagingBonusEffect)),
      5,
    );
  });
});

describe('calculatePrescription — HbA1c 4.5 클램프', () => {
  it('총효과가 너무 커도 newHba1c는 4.5 미만으로 떨어지지 않는다', () => {
    const p = patient('p1');
    const strong = meds
      .filter((m) => !m.isNotDrug && m.effect > 0)
      .sort((a, b) => b.effect - a.effect);
    const result = calculatePrescription({
      patient: p,
      current: { ...getPatientCurrentState(p, [], meds), hba1c: 5.5 },
      slots: slotsWith(strong[0], strong[1]),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newHba1c).toBe(4.5);
  });
});

describe('calculatePrescription — 비약물 전용 처방', () => {
  it('isNotDrug 약제만 처방하면 isLifestyleOnly + msgLifestyle', () => {
    const p = patient('p1');
    const start = getPatientCurrentState(p, [], meds);
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(lifestyle),
      diagCodes: [],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newHba1c).toBe(start.hba1c);
    expect(result.prescription.newWeight).toBeCloseTo(start.weight + lifestyle.effectWeight, 5);
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
      slots: slotsWith(hfDrug),
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
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(hfDrug),
      diagCodes: ['E11', 'I50'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.newLvef).toBe(round1(start.lvef + hfDrug.effectLvef));
    expect(result.prescription.newNtprobnp).toBe(round1(start.ntprobnp + hfDrug.effectNtprobnp));
  });
});

describe('calculatePrescription — 공병증 메시지', () => {
  it('호전 공병증 일치 시 good 엔트리 생성', () => {
    const p = patient('p1'); // comorbidities ['비만']
    const result = calculatePrescription({
      patient: p,
      current: getPatientCurrentState(p, [], meds),
      slots: slotsWith(obesityDrug),
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
      slots: slotsWith(giDrug),
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

describe('calculatePrescription — eGFR 이니셜딥 (첫 노출 시 1회)', () => {
  const p = patient('p2'); // egfr 65

  it('딥 계열 첫 노출: newEgfr = 현재 + 연간 + 딥', () => {
    const start = getPatientCurrentState(p, [], meds);
    const res = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(dipDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      dipClassIds: ['dc_sglt2'],
      experiencedDipClassIds: [],
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(res.prescription.newEgfr).toBe(
      round1(start.egfr + dipDrug.effectEgfr + dipDrug.effectEgfrDip),
    );
  });

  it('이미 딥 계열 경험(experiencedDipClassIds)하면 딥 없이 연간만 적용', () => {
    const start = getPatientCurrentState(p, [], meds);
    const res = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(dipDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      dipClassIds: ['dc_sglt2'],
      experiencedDipClassIds: ['dc_sglt2'],
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(res.prescription.newEgfr).toBe(round1(start.egfr + dipDrug.effectEgfr));
  });

  it('dipClassIds를 주지 않으면(기본) 딥은 적용되지 않는다', () => {
    const start = getPatientCurrentState(p, [], meds);
    const res = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(dipDrug),
      diagCodes: ['E11'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(res.prescription.newEgfr).toBe(round1(start.egfr + dipDrug.effectEgfr));
  });
});

describe('병포장 SGLT-2i 복합제 시나리오 (계획.md M5)', () => {
  it('재진 p2: base 6.8에서 병포장 복합제 강하 + 보너스 차감', () => {
    const p = patient('p2');
    const start = getPatientCurrentState(p, [], meds);
    expect(start.hba1c).toBe(6.8); // §5-1 literal: 재진은 prevDrugs 차감 없이 initialHba1c

    const combo = meds.find(
      (m) => m.pkg === 'bottle' && m.classes.includes('dc_sglt2') && m.classes.includes('dc_met'),
    )!;
    const result = calculatePrescription({
      patient: p,
      current: start,
      slots: slotsWith(combo),
      diagCodes: ['E11', 'I50'],
      settings,
      exemptions: [],
      pastSideEffectCounts: {},
      rng: noSideEffectRng,
      now: fixedNow,
    });
    expect(result.prescription.isPackagingBonus).toBe(true);
    expect(result.prescription.newHba1c).toBeCloseTo(
      round1(Math.max(4.5, 6.8 - (combo.effect + settings.packagingBonusEffect))),
      5,
    );
  });
});
