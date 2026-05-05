import { describe, it, expect } from 'vitest';
import {
  seedPatients,
  seedMedications,
  seedMedCategories,
  seedDrugClasses,
  seedComorbidities,
} from '../src/data/seed';

describe('seed data 분량 검증 (M1 게이트)', () => {
  it('환자 20명', () => {
    expect(seedPatients).toHaveLength(20);
  });

  it('약제 60종', () => {
    expect(seedMedications).toHaveLength(60);
  });

  it('카테고리 6종', () => {
    expect(seedMedCategories).toHaveLength(6);
  });

  it('약물 계열 8종', () => {
    expect(seedDrugClasses).toHaveLength(8);
  });

  it('공병증 10종', () => {
    expect(seedComorbidities).toHaveLength(10);
  });
});

describe('seed data 정합성', () => {
  it('환자 id는 p1~p20', () => {
    const ids = seedPatients.map((p) => p.id);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => `p${i + 1}`));
  });

  it('약제 id 중복 없음', () => {
    const ids = seedMedications.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('약제 categoryId는 모두 등록된 카테고리', () => {
    const catIds = new Set(seedMedCategories.map((c) => c.id));
    for (const m of seedMedications) {
      expect(catIds.has(m.categoryId), `${m.id} ${m.name}`).toBe(true);
    }
  });

  it('약제 classes는 모두 등록된 계열 (생활습관 제외)', () => {
    const classIds = new Set(seedDrugClasses.map((c) => c.id));
    for (const m of seedMedications) {
      if (m.isNotDrug) continue;
      for (const c of m.classes) {
        expect(classIds.has(c), `${m.id} ${m.name} → ${c}`).toBe(true);
      }
    }
  });

  it('환자 prevDrugs 슬롯은 5개', () => {
    for (const p of seedPatients) {
      expect(p.prevDrugs).toHaveLength(5);
    }
  });

  it('환자 prevDrugs의 약제 id는 모두 실재', () => {
    const medIds = new Set(seedMedications.map((m) => m.id));
    for (const p of seedPatients) {
      for (const id of p.prevDrugs) {
        if (id === '') continue;
        expect(medIds.has(id), `${p.id} → ${id}`).toBe(true);
      }
    }
  });
});
