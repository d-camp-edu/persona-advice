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

  order: number;
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
}

export interface Comorbidity {
  name: string;
  goodMsg: string;
  badMsg: string;
  color?: string;
}
