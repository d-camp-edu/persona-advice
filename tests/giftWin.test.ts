import { describe, expect, it } from 'vitest';
import { pickWinnerWithRate, resolveComorbWinRate } from '../src/lib/giftWin';
import type { Comorbidity, Gift } from '../src/types';

const comorb = (over: Partial<Comorbidity>): Comorbidity => ({
  name: 'X',
  goodMsg: '',
  badMsg: '',
  ...over,
});

const gift = (over: Partial<Gift>): Gift => ({
  id: 'g',
  name: 'g',
  imageUrl: '',
  probHospital: 0,
  probClinic: 0,
  order: 1,
  ...over,
});

describe('resolveComorbWinRate', () => {
  const defs: Comorbidity[] = [
    comorb({ name: 'CKD', giftWinHospital: 60, giftWinClinic: 40 }),
    comorb({ name: '비만', giftWinHospital: 20 }), // 의원 미설정
    comorb({ name: '심부전' }), // 둘 다 미설정
  ];

  it('설정된 공병이 없으면 null', () => {
    expect(resolveComorbWinRate(defs, ['심부전'], '병원')).toBeNull();
    expect(resolveComorbWinRate(defs, [], '병원')).toBeNull();
  });

  it('환자에게 없는 공병은 무시', () => {
    expect(resolveComorbWinRate(defs, ['없는공병'], '병원')).toBeNull();
  });

  it('병원/의원에 따라 다른 값을 반환', () => {
    expect(resolveComorbWinRate(defs, ['CKD'], '병원')).toBe(60);
    expect(resolveComorbWinRate(defs, ['CKD'], '의원')).toBe(40);
  });

  it('여러 공병 중 가장 높은 값 사용', () => {
    expect(resolveComorbWinRate(defs, ['CKD', '비만'], '병원')).toBe(60);
  });

  it('한쪽만 설정된 공병은 반대 축 값으로 폴백', () => {
    // 의원: CKD 40, 비만은 의원 미설정 → 병원값 20으로 폴백 → max(40,20)=40
    expect(resolveComorbWinRate(defs, ['CKD', '비만'], '의원')).toBe(40);
    // 의원: 비만만 있으면 병원값 20으로 폴백
    expect(resolveComorbWinRate(defs, ['비만'], '의원')).toBe(20);
  });

  it('0~100 범위로 클램프', () => {
    const d = [comorb({ name: 'A', giftWinHospital: 150 }), comorb({ name: 'B', giftWinHospital: -10 })];
    expect(resolveComorbWinRate(d, ['A'], '병원')).toBe(100);
    expect(resolveComorbWinRate(d, ['B'], '병원')).toBe(0);
  });
});

describe('pickWinnerWithRate', () => {
  const gifts = [
    gift({ id: 'a', probHospital: 30 }),
    gift({ id: 'b', probHospital: 10 }),
  ];

  it('rand가 당첨률 이상이면 꽝(null)', () => {
    expect(pickWinnerWithRate(gifts, '병원', 60, 0.6, 0)).toBeNull();
    expect(pickWinnerWithRate(gifts, '병원', 60, 0.99, 0)).toBeNull();
  });

  it('rand가 당첨률 미만이면 선물 당첨', () => {
    expect(pickWinnerWithRate(gifts, '병원', 60, 0.0, 0)?.id).toBe('a');
  });

  it('당첨 시 선물은 기존 확률 비율대로 추첨', () => {
    // total=40, r=rand01b*40. a는 [0,30), b는 [30,40)
    expect(pickWinnerWithRate(gifts, '병원', 100, 0, 0.1)?.id).toBe('a'); // r=4
    expect(pickWinnerWithRate(gifts, '병원', 100, 0, 0.9)?.id).toBe('b'); // r=36
  });

  it('선물별 확률이 모두 0이면 균등 추첨으로 폴백', () => {
    const zero = [gift({ id: 'a' }), gift({ id: 'b' })];
    expect(pickWinnerWithRate(zero, '병원', 100, 0, 0.0)?.id).toBe('a');
    expect(pickWinnerWithRate(zero, '병원', 100, 0, 0.99)?.id).toBe('b');
  });

  it('선물이 없으면 null', () => {
    expect(pickWinnerWithRate([], '병원', 100, 0, 0)).toBeNull();
  });
});
