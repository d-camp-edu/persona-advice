import type { GlobalSettings } from '../../types';
import { seedComorbidities } from './comorbidities.seed';

export const defaultLoginFields = [
  { id: 'division', label: '사업부명', placeholder: '예: 당뇨사업부', required: true, order: 1 },
  { id: 'team', label: '팀명', placeholder: '예: 영업1팀', required: true, order: 2 },
  { id: 'representative', label: '담당자명', placeholder: '예: 홍길동', required: true, order: 3 },
  { id: 'employeeId', label: '사번', placeholder: '예: 123456', required: true, order: 4 },
  { id: 'customerCode', label: '거래처코드', placeholder: '예: A0001', required: false, order: 5 },
  { id: 'hospital', label: '병원명', placeholder: '예: 서울대학교병원 내분비내과', required: true, order: 6 },
  { id: 'doctor', label: 'Dr.명', placeholder: '예: 홍길동', required: true, order: 7 },
];

export const seedSettings: GlobalSettings = {
  loginBgStart: '#6366f1',
  loginBgEnd: '#9333ea',
  loginBtnColor: '#6366f1',
  loginLogoUrl: '',
  loginMainTitle: 'Persona Rx',
  loginSubTitle: '당뇨 처방 시뮬레이터',
  loginTitleIconUrl: '',
  encounterDoctorImg: '',
  backgroundImgUrl: '',
  loginFields: defaultLoginFields,

  packagingBonusEffect: 0.3,
  initialMetforminThreshold: 6.5,
  dualTherapyThreshold: 7.5,
  sglt2EgfrLimit: 25,

  hfLvefMax: 40,
  hfNyhaMin: 2,
  hfBnpMin: 35,
  hfNtprobnpMin: 125,

  ckdEgfrMin: 20,
  ckdEgfrMax: 75,
  ckdUacrMin: 200,

  msgSuccess: '선생님 덕분에 컨디션이 아주 좋습니다! 약이 잘 맞네요.',
  msgSideEffect: '선생님, 약을 먹고 나서 속이 좀 불편해요.',
  msgPackaging: '병포장이라 약 챙겨 먹기가 훨씬 수월하네요!',
  msgLifestyle: '추천해주신 대로 생활습관을 바꾸니 몸이 가볍습니다.',

  comorbidities: seedComorbidities,
  adminPassword: '1024',
  allowSessionCarryover: false,
};
