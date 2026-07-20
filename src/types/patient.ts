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
  /**
   * 현재 복용 중인 처방(prevDrugs)의 슬롯별 BID(1일 2회) 여부. prevDrugs와 같은 인덱스로 정렬.
   * 없거나 짧으면 해당 슬롯은 QD(1배)로 간주한다(하위호환). 생활습관(비약물) 슬롯엔 무의미.
   */
  prevDrugBids?: boolean[];
  prevTreatment: string;
  otherMedications?: string;

  imageUrl: string;
  brochureUrl?: string;
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
