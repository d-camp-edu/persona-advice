import type { Comorbidity } from './medication';

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

  packagingBonusEffect: number;
  initialMetforminThreshold: number;
  dualTherapyThreshold: number;
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
  adminPassword: string;
  allowSessionCarryover: boolean;
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
