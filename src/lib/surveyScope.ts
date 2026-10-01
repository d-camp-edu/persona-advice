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

/** 품목 지정이 없는 '공통' 질문인지. (필드 자체가 없는 기존 문서도 공통) */
export function isCommonQuestion(q: SurveyQuestion): boolean {
  const scope = q.productScope;
  return !scope || scope.length === 0;
}

/** 이 질문이 해당 품목에 '지정된' 질문인지. 공통 질문은 지정이 아니므로 false. */
export function questionAppliesToProduct(q: SurveyQuestion, productId: string): boolean {
  const scope = q.productScope;
  if (!scope || scope.length === 0) return false;
  if (!productId) return false; // '직접 입력' 로그인은 품목이 없다 → 지정 질문 미노출
  return scope.includes(productId);
}

/**
 * 품목 대체 규칙 — 해당 품목에 지정된 질문이 하나라도 있으면 그것만 쓰고 공통은 숨긴다.
 * 없으면 공통 질문으로 폴백한다.
 *
 * ⚠️ 이 판정은 반드시 surveyOnly·공병증 필터를 **통과한 뒤의 후보 집합**에 적용해야 한다.
 * 앞에 두면 "품목 A에 서베이 전용 질문만 있는 경우 환자별 서베이가 통째로 비어버리는" 사고가 난다.
 * (두 흐름이 각자 독립적으로 '내 품목 질문이 있냐'를 판정해야 한다)
 *
 * productId가 ''(직접 입력 로그인)이면 지정 질문은 전부 매칭되지 않아 항상 공통만 남는다.
 * productScope 필드가 없는 기존 질문은 전부 공통이라, 품목을 쓰기 전까지 동작이 바뀌지 않는다.
 */
export function applyProductScope(
  candidates: SurveyQuestion[],
  productId: string,
): SurveyQuestion[] {
  const matched = candidates.filter((q) => questionAppliesToProduct(q, productId));
  if (matched.length > 0) return matched;
  return candidates.filter(isCommonQuestion);
}

/**
 * 환자의 공병증·담당자 품목에 맞는 서베이 질문만 골라 순서대로 정렬해 반환.
 * '서베이만 진행' 전용 질문(surveyOnly)은 환자 시연 중 서베이에서 제외한다.
 */
export function surveyQuestionsForPatient(
  questions: SurveyQuestion[],
  comorbidities: string[],
  productId = '',
): SurveyQuestion[] {
  const candidates = questions.filter(
    (q) => !q.surveyOnly && questionAppliesToComorbidities(q, comorbidities),
  );
  return applyProductScope(candidates, productId).sort((a, b) => a.order - b.order);
}

/** '서베이만 진행' 흐름에서 노출할 질문(surveyOnly=true)만 품목 규칙 적용해 순서대로 반환. */
export function surveyOnlyQuestions(
  questions: SurveyQuestion[],
  productId = '',
): SurveyQuestion[] {
  const candidates = questions.filter((q) => q.surveyOnly);
  return applyProductScope(candidates, productId).sort((a, b) => a.order - b.order);
}
