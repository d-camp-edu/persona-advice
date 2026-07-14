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
  /**
   * eGFR 이니셜딥(mL/min). 해당 계열(SGLT-2i 등)에 처음 노출될 때 1회만 적용되는
   * 치료 초기 일시적 eGFR 하강. 같은 딥 계열을 이미 경험한 환자(이전 복용약 또는
   * 세션 내 이전 처방)에게는 적용하지 않는다. 부호 그대로 더한다(음수=하강).
   */
  effectEgfrDip: number;
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
