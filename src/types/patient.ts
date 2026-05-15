export type PatientType = '초진' | '재진' | '리핏';
export type Gender = 'M' | 'F';
export type Adherence = '좋음' | '나쁨';

export interface PatientMetricDef {
  id: string;
  label: string;
  unit: string;
  direction: 'decrease_good' | 'increase_good';
  isBuiltIn: boolean;
  enabled: boolean;
  order: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  weight: number;
  bmi: number;
  initialHba1c: number;
  type: PatientType;
  desc: string;
  comorbidities: string[];
  adherence: Adherence;
  order: number;

  lvef: number;
  nyha: number;
  bnp: number;
  ntprobnp: number;
  hfHospitalization: boolean;
  echoAbnormal: boolean;
  hfStandardTx: boolean;

  egfr: number;
  uacr: number;
  dipstick: boolean;
  ckdStandardTx: boolean;

  prevDrugs: string[];
  prevTreatment: string;

  imageUrl: string;
  customMetrics?: Record<string, number>;
}

export interface CurrentState {
  hba1c: number;
  weight: number;
  lvef: number;
  nyha: number;
  bnp: number;
  ntprobnp: number;
  egfr: number;
  uacr: number;
  customMetrics?: Record<string, number>;
}
