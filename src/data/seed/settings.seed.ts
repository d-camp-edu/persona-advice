import type { GlobalSettings } from '../../types';
import { seedComorbidities } from './comorbidities.seed';

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
