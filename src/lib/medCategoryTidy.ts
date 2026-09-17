import type { MedCategory, Medication, Pkg } from '../types';

/**
 * 약제 구분(카테고리)을 계열 수에서 파생한다.
 *
 * 엑셀 '카테고리' 열은 쓰지 않는다 (CLAUDE.md · scripts/genMedications.mjs 상단 주석):
 *   비약물(생활습관)      → cat_lifestyle
 *   포장=injection        → cat_injection   (계열 수 무관)
 *   계열 3개 이상         → cat_combo3      3제 복합제
 *   계열 2개(biguanide O) → cat_combo_met   메폴민 2제 복합제
 *   계열 2개(biguanide X) → cat_combo2      2제 복합제
 *   그 외(계열 1개·0개)   → cat_single      단일제
 *
 * ⚠️ scripts/genMedications.mjs 의 categoryFromRow() 와 동일해야 한다.
 */
export function deriveCategoryId(med: {
  pkg: Pkg;
  classes: string[];
  isNotDrug?: boolean;
}): string {
  if (med.isNotDrug) return 'cat_lifestyle';
  if (med.pkg === 'injection') return 'cat_injection';
  const n = med.classes.length;
  if (n >= 3) return 'cat_combo3';
  if (n === 2) return med.classes.includes('dc_met') ? 'cat_combo_met' : 'cat_combo2';
  return 'cat_single';
}

/** 제품명에서 한글만 남긴 '제품 뿌리 이름'. 용량·괄호·영문 표기 차이를 무시하고 동일 제품을 묶는다. */
export function productBaseName(name: string): string {
  return name.replace(/[^가-힣]/g, '');
}

export interface CategoryFix {
  med: Medication;
  from: string;
  to: string;
}

export interface SuspectMed {
  med: Medication;
  /** 이름이 겹치는 시드 약제 */
  twin: Medication;
}

export interface TidyPlan {
  /** categoryId 를 계열 수 기준으로 다시 배정해야 하는 약제 */
  catFixes: CategoryFix[];
  /** 재배정 결과 실제로 쓰이는데 Firestore 에 없는 기준 카테고리 → 생성 */
  missingCategories: MedCategory[];
  /** 기준 카테고리가 아니면서 재배정 후 약제가 0종이 되는 카테고리 → 삭제 */
  staleCategories: MedCategory[];
  /**
   * 시드에 없는(손으로 추가한) 약제 중, 시드 제품과 이름은 같은데 계열 구성이 다른 것.
   * 계열을 잘못 고른 중복 등록으로 보이는 문서다. 삭제 후보로만 올리고 판단은 사용자에게 맡긴다.
   * 같은 제품의 새 용량을 손으로 추가한 경우(계열이 같다)는 걸리지 않는다.
   */
  suspectMeds: SuspectMed[];
}

/**
 * 카테고리 정리 계획을 세운다 (읽기 전용 — 쓰기는 호출부에서).
 *
 * Firestore 약제 데이터가 여러 세대의 시드에 걸쳐 쌓이면서 옛 카테고리 id(cat_combo 등)나
 * 계열 수와 어긋난 배정이 남는다. 이 함수는 현재 상태와 무관하게 '계열 수 → 카테고리'
 * 규칙 하나만 보고 최종 형태를 계산한다.
 */
export function planCategoryTidy(
  meds: Medication[],
  categories: MedCategory[],
  seedMeds: Medication[],
  seedCategories: MedCategory[],
): TidyPlan {
  const catFixes: CategoryFix[] = [];
  const targetCounts = new Map<string, number>();

  for (const m of meds) {
    const to = deriveCategoryId(m);
    targetCounts.set(to, (targetCounts.get(to) ?? 0) + 1);
    if (m.categoryId !== to) catFixes.push({ med: m, from: m.categoryId, to });
  }

  const presentCatIds = new Set(categories.map((c) => c.id));
  const seedCatIds = new Set(seedCategories.map((c) => c.id));

  const missingCategories = seedCategories.filter(
    (c) => !presentCatIds.has(c.id) && (targetCounts.get(c.id) ?? 0) > 0,
  );
  const staleCategories = categories.filter(
    (c) => !seedCatIds.has(c.id) && (targetCounts.get(c.id) ?? 0) === 0,
  );

  const seedIds = new Set(seedMeds.map((m) => m.id));
  const sameClasses = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

  const suspectMeds: SuspectMed[] = [];
  for (const m of meds) {
    if (seedIds.has(m.id)) continue;
    const base = productBaseName(m.name);
    if (base.length < 3) continue;
    const twin = seedMeds.find((s) => {
      const sb = productBaseName(s.name);
      if (sb.length < 3) return false;
      return sb === base || sb.includes(base) || base.includes(sb);
    });
    if (twin && !sameClasses(m.classes, twin.classes)) suspectMeds.push({ med: m, twin });
  }

  return { catFixes, missingCategories, staleCategories, suspectMeds };
}
