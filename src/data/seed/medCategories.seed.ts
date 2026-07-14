import type { MedCategory } from '../../types';

export const seedMedCategories: MedCategory[] = [
  { id: 'cat_single', name: '단일제', order: 1 },
  { id: 'cat_combo', name: '복합제', order: 2 },
  { id: 'cat_injection', name: '주사제 (인슐린·GLP-1)', order: 3 },
  { id: 'cat_lifestyle', name: '기타/생활습관', order: 4 },
];
