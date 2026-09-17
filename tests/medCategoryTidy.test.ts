import { describe, expect, it } from 'vitest';
import { deriveCategoryId, planCategoryTidy, productBaseName } from '../src/lib/medCategoryTidy';
import { seedMedCategories, seedMedications } from '../src/data/seed';
import type { MedCategory, Medication } from '../src/types';

function med(over: Partial<Medication> & { id: string }): Medication {
  return {
    name: '테스트약',
    categoryId: 'cat_single',
    pkg: 'ptp',
    classes: [],
    isNotDrug: false,
    effect: 0,
    effectWeight: 0,
    effectLvef: 0,
    effectBnp: 0,
    effectNtprobnp: 0,
    effectEgfr: 0,
    effectEgfrDip: 0,
    effectUacr: 0,
    beneficialComorb: [],
    worseningComorb: [],
    sideEffectProb: 0,
    sideEffectPenalty: 0,
    sideEffectMsg: '',
    egfrLimit: 0,
    allowHFrEFCoverage: false,
    allowHFpEFCoverage: false,
    allowCkdCoverage: false,
    isInsuranceException: false,
    allow2TQD: false,
    order: 1,
    ...over,
  };
}

const cat = (id: string, name: string, order = 1): MedCategory => ({ id, name, order });

describe('deriveCategoryId', () => {
  it('계열 수로 단일제/2제/메폴민 2제/3제를 나눈다', () => {
    expect(deriveCategoryId({ pkg: 'ptp', classes: ['dc_dpp4'] })).toBe('cat_single');
    expect(deriveCategoryId({ pkg: 'ptp', classes: ['dc_dpp4', 'dc_sglt2'] })).toBe('cat_combo2');
    expect(deriveCategoryId({ pkg: 'ptp', classes: ['dc_dpp4', 'dc_met'] })).toBe('cat_combo_met');
    expect(deriveCategoryId({ pkg: 'ptp', classes: ['dc_met', 'dc_sglt2', 'dc_tzd'] })).toBe(
      'cat_combo3',
    );
  });

  it('주사제·비약물은 계열 수와 무관하게 별도 구분', () => {
    expect(deriveCategoryId({ pkg: 'injection', classes: ['dc_glp1'] })).toBe('cat_injection');
    expect(deriveCategoryId({ pkg: 'injection', classes: ['dc_met', 'dc_sglt2'] })).toBe(
      'cat_injection',
    );
    expect(deriveCategoryId({ pkg: 'ptp', classes: [], isNotDrug: true })).toBe('cat_lifestyle');
  });

  it('커밋된 시드는 이미 이 규칙을 만족한다', () => {
    for (const m of seedMedications) {
      expect(`${m.name}:${m.categoryId}`).toBe(`${m.name}:${deriveCategoryId(m)}`);
    }
  });
});

describe('productBaseName', () => {
  it('용량·영문·기호를 떼고 한글 제품명만 남긴다', () => {
    expect(productBaseName('듀비엠폴서방정 0.25/12.5/1000mg')).toBe('듀비엠폴서방정');
    expect(productBaseName('란투스주(글라진 U100) 100 IU/mL')).toBe('란투스주글라진');
  });
});

describe('planCategoryTidy', () => {
  it('계열 수와 어긋난 약제만 재배정 대상으로 잡는다', () => {
    const meds = [
      med({ id: 'a', classes: ['dc_met', 'dc_sglt2', 'dc_tzd'], categoryId: 'cat_combo2' }),
      med({ id: 'b', classes: ['dc_dpp4', 'dc_sglt2'], categoryId: 'cat_combo2' }),
    ];
    const plan = planCategoryTidy(meds, seedMedCategories, seedMedications, seedMedCategories);
    expect(plan.catFixes).toHaveLength(1);
    expect(plan.catFixes[0]).toMatchObject({ from: 'cat_combo2', to: 'cat_combo3' });
  });

  it('옛 카테고리(cat_combo)는 비워진 뒤 삭제 대상이 된다', () => {
    const meds = [
      med({ id: 'a', classes: ['dc_dpp4', 'dc_sglt2'], categoryId: 'cat_combo' }),
      med({ id: 'b', classes: ['dc_dpp4', 'dc_met'], categoryId: 'cat_combo' }),
    ];
    const cats = [...seedMedCategories, cat('cat_combo', '복합제', 9)];
    const plan = planCategoryTidy(meds, cats, seedMedications, seedMedCategories);
    expect(plan.catFixes.map((f) => f.to)).toEqual(['cat_combo2', 'cat_combo_met']);
    expect(plan.staleCategories.map((c) => c.id)).toEqual(['cat_combo']);
  });

  it('기준 카테고리는 약제가 실제로 배정될 때만 생성 대상이 된다', () => {
    const meds = [med({ id: 'a', classes: ['dc_met', 'dc_sglt2', 'dc_tzd'], categoryId: 'x' })];
    const cats = [cat('x', '옛구분', 1)];
    const plan = planCategoryTidy(meds, cats, seedMedications, seedMedCategories);
    expect(plan.missingCategories.map((c) => c.id)).toEqual(['cat_combo3']);
    expect(plan.staleCategories.map((c) => c.id)).toEqual(['x']);
  });

  it('이름이 겹치면서 계열이 다른 손추가 약제를 삭제 후보로 올린다', () => {
    const meds = [med({ id: 'hand_1', name: '듀비엠폴서방정 0.5/25/1000mg', classes: ['dc_tzd'] })];
    const plan = planCategoryTidy(meds, seedMedCategories, seedMedications, seedMedCategories);
    expect(plan.suspectMeds).toHaveLength(1);
    expect(plan.suspectMeds[0].twin.name).toContain('듀비엠폴');
  });

  it('같은 제품의 새 용량을 손으로 추가한 경우(계열 동일)는 건드리지 않는다', () => {
    const meds = [
      med({
        id: 'hand_2',
        name: '듀비엠폴서방정 0.25/25/1000mg',
        classes: ['dc_met', 'dc_sglt2', 'dc_tzd'],
        categoryId: 'cat_combo3',
      }),
    ];
    const plan = planCategoryTidy(meds, seedMedCategories, seedMedications, seedMedCategories);
    expect(plan.suspectMeds).toHaveLength(0);
    expect(plan.catFixes).toHaveLength(0);
  });

  it('시드 약제는 손추가 판정에서 제외된다', () => {
    const plan = planCategoryTidy(
      seedMedications,
      seedMedCategories,
      seedMedications,
      seedMedCategories,
    );
    expect(plan.suspectMeds).toHaveLength(0);
    expect(plan.catFixes).toHaveLength(0);
    expect(plan.staleCategories).toHaveLength(0);
    expect(plan.missingCategories).toHaveLength(0);
  });
});
