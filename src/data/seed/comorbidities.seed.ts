import type { Comorbidity } from '../../types';

export const seedComorbidities: Comorbidity[] = [
  { name: '심부전', goodMsg: '숨차는 증상도 덜하고 편안해졌어요.', badMsg: '숨이 차고 가슴이 답답해요.', color: 'blue' },
  { name: '만성신장질환(CKD)', goodMsg: '소변 거품도 줄고 붓기도 덜하네요!', badMsg: '소변 보기가 불편하고 더 붓는 것 같아요.', color: 'yellow' },
  { name: '비만', goodMsg: '체중이 줄어서 몸이 가볍습니다!', badMsg: '살이 더 찌는 것 같아 걱정이에요.', color: 'green' },
  { name: '심혈관', goodMsg: '심장 건강이 좋아진 것 같아 안심입니다.', badMsg: '심장 쪽이 왠지 모르게 불편합니다.', color: 'red' },
  { name: 'MASH', goodMsg: '간 수치도 좋아지고 피로감도 덜합니다.', badMsg: '간 쪽에 무리가 가는 건 아닐지 걱정돼요.', color: 'orange' },
  { name: 'Stroke', goodMsg: '뇌졸중 예방도 된다니 마음이 놓입니다.', badMsg: '머리 쪽이 가끔 어지러운 것 같아요.', color: 'purple' },
  { name: '위장장애', goodMsg: '속이 편안해서 다행입니다.', badMsg: '약 먹고 속이 더부룩하고 소화가 안 돼요.' },
  { name: '생식기감염', goodMsg: '특별한 감염 증상 없이 깨끗합니다.', badMsg: '소변 볼 때 불편하고 가렵습니다.' },
  { name: '저혈당', goodMsg: '저혈당 없이 안정적으로 유지되고 있어요.', badMsg: '가끔 식은땀이 나고 손이 떨려요.' },
  { name: '전반적 개선', goodMsg: '전체적인 컨디션이 몰라보게 좋아졌습니다!', badMsg: '아직 전체적인 컨디션은 잘 모르겠습니다.' },
];
