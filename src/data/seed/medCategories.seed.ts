import type { MedCategory } from '../../types';

// 약제 구분(카테고리)은 계열 체크 수로 파생한다 (scripts/genMedications.mjs · lib/medExcelImport.ts):
//   계열 1개                → cat_single      단일제
//   계열 2개(biguanide 제외) → cat_combo2      2제 복합제
//   계열 2개(biguanide 포함) → cat_combo_met   메폴민 2제 복합제
//   계열 3개 이상            → cat_combo3      3제 복합제
// 주사제(포장=injection)와 비약물(생활습관)은 계열 수와 무관하게 별도 구분으로 유지한다.
export const seedMedCategories: MedCategory[] = [
  { id: 'cat_single', name: '단일제', order: 1 },
  { id: 'cat_combo2', name: '2제 복합제', order: 2 },
  { id: 'cat_combo_met', name: '메폴민 2제 복합제', order: 3 },
  { id: 'cat_combo3', name: '3제 복합제', order: 4 },
  { id: 'cat_injection', name: '주사제 (인슐린·GLP-1)', order: 5 },
  { id: 'cat_lifestyle', name: '기타/생활습관', order: 6 },
];
