import type { Gift } from '../../types';

// 기본 선물 목록 (Admin "선물 관리" 탭에서 수정/이미지 등록 가능).
// 확률 합이 100 미만이면 나머지는 자동으로 '꽝'이 된다.
export const seedGifts: Gift[] = [
  { id: 'gift_coffee', name: '커피 기프티콘', imageUrl: '', probHospital: 30, probClinic: 30, order: 1 },
  { id: 'gift_voucher', name: '편의점 5천원권', imageUrl: '', probHospital: 20, probClinic: 25, order: 2 },
  { id: 'gift_pen', name: '고급 볼펜 세트', imageUrl: '', probHospital: 15, probClinic: 15, order: 3 },
];
