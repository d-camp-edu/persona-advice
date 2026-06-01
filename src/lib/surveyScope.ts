import type { SurveyQuestion } from '../types';

/**
 * 이 질문이 주어진 환자구분(공병증) 집합에 노출돼야 하는지 판정.
 * - comorbidityScope가 비어 있거나 없으면 모든 환자에게 공통 노출.
 * - 값이 있으면 환자가 해당 공병증 중 하나라도 가질 때만 노출.
 */
export function questionAppliesToComorbidities(
  q: SurveyQuestion,
  comorbidities: string[],
): boolean {
  const scope = q.comorbidityScope;
  if (!scope || scope.length === 0) return true;
  return scope.some((c) => comorbidities.includes(c));
}

/** 환자의 공병증에 맞는 서베이 질문만 골라 순서대로 정렬해 반환. */
export function surveyQuestionsForPatient(
  questions: SurveyQuestion[],
  comorbidities: string[],
): SurveyQuestion[] {
  return questions
    .filter((q) => questionAppliesToComorbidities(q, comorbidities))
    .sort((a, b) => a.order - b.order);
}
