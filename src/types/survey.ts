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
  answeredAt: string;
  answers: Record<string, string | string[]>;
  loginFieldValues?: Record<string, string>;
}
