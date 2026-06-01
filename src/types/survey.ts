export interface SurveyQuestion {
  id: string;
  order: number;
  text: string;
  type: 'single' | 'multi' | 'text';
  options: string[];
  required: boolean;
}

export interface SurveyResponse {
  id: string;
  sessionDocId: string;
  doctorName: string;
  hospitalName: string;
  department?: string;
  institutionType?: '병원' | '의원';
  /** 이 서베이가 어떤 환자 시뮬레이션 직전에 진행됐는지 (환자별 서베이) */
  patientId?: string;
  patientName?: string;
  answeredAt: string;
  answers: Record<string, string | string[]>;
  loginFieldValues?: Record<string, string>;
}
