import type { SurveyQuestion } from '../../types';

export const seedSurveyQuestions: SurveyQuestion[] = [
  {
    id: 'sq_1',
    order: 1,
    text: '선생님은 당뇨 환자를 주당 평균 몇 명 진료하십니까?',
    type: 'single',
    options: ['5명 미만', '5~15명', '15~30명', '30명 이상'],
    required: true,
  },
  {
    id: 'sq_2',
    order: 2,
    text: '최근 처방에서 가장 많이 사용하시는 당뇨약 계열을 선택해 주세요.',
    type: 'single',
    options: ['메트포르민', 'SGLT-2 억제제', 'DPP-4 억제제', 'GLP-1 수용체 작용제', '기타'],
    required: true,
  },
  {
    id: 'sq_3',
    order: 3,
    text: '처방 시 보험 삭감을 경험하신 적이 있으십니까?',
    type: 'single',
    options: ['예, 자주 있습니다', '가끔 있습니다', '거의 없습니다'],
    required: false,
  },
  {
    id: 'sq_4',
    order: 4,
    text: '오늘 시연에서 특별히 관심 있는 약제나 임상 상황이 있으시다면 알려주세요.',
    type: 'text',
    options: [],
    required: false,
  },
];
