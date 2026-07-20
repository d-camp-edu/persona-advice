export interface SurveyQuestion {
  id: string;
  order: number;
  text: string;
  type: 'single' | 'multi' | 'text';
  options: string[];
  required: boolean;
  /**
   * 이 질문을 노출할 환자구분(공병증) 이름 목록.
   * 비어 있거나 undefined면 모든 환자에게 공통으로 노출한다.
   * 값이 있으면 선택된 환자가 해당 공병증 중 하나라도 가질 때만 노출한다.
   */
  comorbidityScope?: string[];
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
  /** 담당자 사번. 조회를 서버 where 쿼리로 좁히기 위한 인덱스 필드. (없을 수 있음) */
  empNo?: string;
}
