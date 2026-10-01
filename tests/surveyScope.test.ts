import { describe, it, expect } from 'vitest';
import {
  applyProductScope,
  surveyOnlyQuestions,
  surveyQuestionsForPatient,
} from '../src/lib/surveyScope';
import type { SurveyQuestion } from '../src/types';

function q(id: string, over: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return {
    id,
    order: Number(id.replace(/\D/g, '')) || 1,
    text: id,
    type: 'single',
    options: ['a', 'b'],
    required: false,
    ...over,
  };
}

const ids = (list: SurveyQuestion[]) => list.map((x) => x.id);

describe('productScope — 기존 설정 회귀 방지', () => {
  // productScope 필드가 아예 없는 기존 Firestore 문서가 그대로 동작해야 한다.
  const legacy = [q('q1'), q('q2'), q('q3', { comorbidityScope: ['심부전'] })];

  it('품목 지정 질문이 없으면 품목을 고른 담당자도 공통 질문 전부를 본다', () => {
    expect(ids(surveyQuestionsForPatient(legacy, [], 'prod_a'))).toEqual(['q1', 'q2']);
    expect(ids(surveyQuestionsForPatient(legacy, ['심부전'], 'prod_a'))).toEqual([
      'q1',
      'q2',
      'q3',
    ]);
  });

  it("'직접 입력' 로그인(productId='')도 공통 질문 전부를 본다", () => {
    expect(ids(surveyQuestionsForPatient(legacy, [], ''))).toEqual(['q1', 'q2']);
  });

  it('productId 인자를 생략해도 종전과 동일하게 동작한다', () => {
    expect(ids(surveyQuestionsForPatient(legacy, []))).toEqual(['q1', 'q2']);
  });
});

describe('applyProductScope — 대체 규칙', () => {
  const list = [
    q('q1'),
    q('q2', { productScope: ['prod_a'] }),
    q('q3', { productScope: ['prod_a', 'prod_b'] }),
  ];

  it('내 품목 지정 질문이 있으면 그것만 쓰고 공통은 숨긴다', () => {
    expect(ids(applyProductScope(list, 'prod_a'))).toEqual(['q2', 'q3']);
    expect(ids(applyProductScope(list, 'prod_b'))).toEqual(['q3']);
  });

  it('내 품목 지정 질문이 없으면 공통으로 폴백한다', () => {
    expect(ids(applyProductScope(list, 'prod_c'))).toEqual(['q1']);
  });

  it("품목이 없는 세션은 지정 질문을 보지 않는다", () => {
    expect(ids(applyProductScope(list, ''))).toEqual(['q1']);
  });

  it('빈 배열 productScope는 공통으로 취급한다', () => {
    expect(ids(applyProductScope([q('q1', { productScope: [] })], 'prod_a'))).toEqual(['q1']);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const src = [q('q9', { productScope: ['prod_a'] }), q('q1')];
    applyProductScope(src, 'prod_a');
    expect(ids(src)).toEqual(['q9', 'q1']);
  });
});

describe('품목 × 공병증 (AND)', () => {
  const list = [
    q('q1'), // 공통
    q('q2', { productScope: ['prod_a'], comorbidityScope: ['심부전'] }),
  ];

  it('품목은 맞지만 공병증이 안 맞으면 제외되고 공통으로 폴백한다', () => {
    expect(ids(surveyQuestionsForPatient(list, ['CKD'], 'prod_a'))).toEqual(['q1']);
  });

  it('품목·공병증이 모두 맞으면 그 질문만 노출한다', () => {
    expect(ids(surveyQuestionsForPatient(list, ['심부전'], 'prod_a'))).toEqual(['q2']);
  });
});

describe('surveyOnly 흐름과 환자 흐름은 독립 판정', () => {
  // 품목 A에 '서베이 전용' 지정 질문만 있는 경우.
  // 품목 판정을 surveyOnly 필터보다 먼저 하면 환자별 서베이가 통째로 비어버린다.
  const list = [
    q('q1'), // 환자 서베이 공통
    q('q2', { surveyOnly: true }), // 서베이 전용 공통
    q('q3', { surveyOnly: true, productScope: ['prod_a'] }), // 서베이 전용 · 품목 A
  ];

  it('환자별 서베이는 품목 A 담당자에게도 공통 질문을 보여준다', () => {
    expect(ids(surveyQuestionsForPatient(list, [], 'prod_a'))).toEqual(['q1']);
  });

  it("'서베이만 진행'은 품목 A 질문으로 대체된다", () => {
    expect(ids(surveyOnlyQuestions(list, 'prod_a'))).toEqual(['q3']);
  });

  it("다른 품목의 '서베이만 진행'은 공통 전용 질문을 쓴다", () => {
    expect(ids(surveyOnlyQuestions(list, 'prod_b'))).toEqual(['q2']);
    expect(ids(surveyOnlyQuestions(list, ''))).toEqual(['q2']);
  });
});

describe('정렬', () => {
  it('order 오름차순으로 정렬한다', () => {
    const list = [
      q('q5', { order: 5, productScope: ['prod_a'] }),
      q('q2', { order: 2, productScope: ['prod_a'] }),
    ];
    expect(ids(surveyQuestionsForPatient(list, [], 'prod_a'))).toEqual(['q2', 'q5']);
  });
});
