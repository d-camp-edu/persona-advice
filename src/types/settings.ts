import type { Comorbidity } from './medication';

export interface LoginFieldDef {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  order: number;
}

export interface GlobalSettings {
  loginBgStart: string;
  loginBgEnd: string;
  loginBtnColor: string;
  loginLogoUrl: string;
  loginMainTitle: string;
  loginSubTitle: string;
  loginTitleIconUrl: string;
  encounterDoctorImg: string;
  backgroundImgUrl: string;
  loginFields?: LoginFieldDef[];

  packagingBonusEffect: number;
  initialMetforminThreshold: number;
  /** 초진(신규) 환자에서 2제 병용을 급여로 시작할 수 있는 HbA1c 하한 (기본 7.5) */
  dualTherapyThreshold: number;
  /** 이미 처방받던 환자에 약제를 추가 병용할 때 허용되는 HbA1c 하한 (기본 7.0) */
  addOnTherapyThreshold: number;
  /** 급여로 병용 가능한 최대 약제 계열 수. 초과(예: 4제 이상)하면 삭감 (기본 3) */
  maxInsuranceClasses: number;
  sglt2EgfrLimit: number;

  hfLvefMax: number;
  hfNyhaMin: number;
  hfBnpMin: number;
  hfNtprobnpMin: number;

  ckdEgfrMin: number;
  ckdEgfrMax: number;
  ckdUacrMin: number;

  msgSuccess: string;
  msgSideEffect: string;
  msgPackaging: string;
  msgLifestyle: string;

  comorbidities: Comorbidity[];
  allowSessionCarryover: boolean;

  /** 병원 선택 시 노출되는 분과 옵션 목록 (의원 선택 시 미노출) */
  hospitalDepartments?: string[];
}

export interface DeductionRule {
  id: string;
  name: string;
  classIds: string[];
  message: string;
  enabled: boolean;
}

export interface AllowedCombination {
  id: string;
  name: string;
  classIds: string[];
  note: string;
}

export interface SideEffectExemption {
  id: string;
  name: string;
  classIds: string[];
  note: string;
}
