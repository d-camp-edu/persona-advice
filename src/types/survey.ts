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
  answeredAt: string;
  answers: Record<string, string | string[]>;
}
