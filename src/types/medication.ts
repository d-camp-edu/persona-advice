export type Pkg = 'ptp' | 'bottle' | 'injection';

export interface Medication {
  id: string;
  name: string;
  categoryId: string;
  pkg: Pkg;
  classes: string[];
  isNotDrug: boolean;

  effect: number;
  effectWeight: number;
  effectLvef: number;
  effectBnp: number;
  effectNtprobnp: number;
  effectEgfr: number;
  effectUacr: number;

  beneficialComorb: string[];
  worseningComorb: string[];

  sideEffectProb: number;
  sideEffectPenalty: number;
  sideEffectMsg: string;

  egfrLimit: number;
  allowHFrEFCoverage: boolean;
  allowHFpEFCoverage: boolean;
  allowCkdCoverage: boolean;
  isInsuranceException: boolean;
  allow2TQD: boolean;

  /** 아사(자사) 제품 — 처방 슬롯 선택 시 목록 최상단에 노출 */
  isAsaProduct?: boolean;

  order: number;
  customEffects?: Record<string, number>;
}

export interface MedCategory {
  id: string;
  name: string;
  order: number;
}

export interface DrugClass {
  id: string;
  name: string;
  duplicatable: boolean;
  /** 약제 관리 화면에서 카테고리 내 계열 그룹 정렬 순서 (설정에서 드래그로 조정) */
  order: number;
}

export interface Comorbidity {
  name: string;
  goodMsg: string;
  badMsg: string;
  color?: string;
}
