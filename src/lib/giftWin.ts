import type { Comorbidity, Gift } from '../types';
import type { InstitutionType } from '../store/useSessionStore';

/**
 * 환자의 공병 목록에서 리워드 룰렛 총 당첨 확률 오버라이드를 구한다.
 * 값이 설정된 공병이 여러 개면 가장 높은 값을 사용한다(가장 유리하게).
 * 설정된 공병이 하나도 없으면 null → 호출부는 기존(선물별 확률 합) 동작을 사용한다.
 */
export function resolveComorbWinRate(
  comorbidities: Comorbidity[],
  patientComorbNames: string[],
  institutionType: InstitutionType,
): number | null {
  const names = new Set(patientComorbNames);
  let best: number | null = null;
  for (const c of comorbidities) {
    if (!names.has(c.name)) continue;
    // 해당 기관 유형 값을 우선 사용하되, 비어 있으면 다른 유형에 입력된 값으로 폴백한다.
    // (병원/의원 한쪽만 입력해도 그 공병에는 당첨 확률이 적용되도록)
    const primary = institutionType === '병원' ? c.giftWinHospital : c.giftWinClinic;
    const secondary = institutionType === '병원' ? c.giftWinClinic : c.giftWinHospital;
    const rate = typeof primary === 'number' ? primary : secondary;
    if (typeof rate !== 'number' || Number.isNaN(rate)) continue;
    const clamped = Math.max(0, Math.min(100, rate));
    if (best === null || clamped > best) best = clamped;
  }
  return best;
}

/**
 * 총 당첨 확률이 정해졌을 때, 당첨 시 어떤 선물이 나올지 선물별 기존 확률 비율로 추첨한다.
 * rand01/rand01b 는 [0,1) 난수(테스트 주입용).
 * 반환: 당첨 선물, 또는 null(꽝).
 */
export function pickWinnerWithRate(
  gifts: Gift[],
  institutionType: InstitutionType,
  winRate: number,
  rand01: number,
  rand01b: number,
): Gift | null {
  if (rand01 * 100 >= winRate) return null; // 꽝

  const probs = gifts.map((g) => (institutionType === '병원' ? g.probHospital : g.probClinic));
  const total = probs.reduce((s, p) => s + p, 0);
  // 선물별 확률이 모두 0이면 균등 추첨으로 폴백.
  if (total <= 0) {
    if (gifts.length === 0) return null;
    return gifts[Math.min(gifts.length - 1, Math.floor(rand01b * gifts.length))];
  }
  const r = rand01b * total;
  let cum = 0;
  for (let i = 0; i < gifts.length; i++) {
    cum += probs[i];
    if (r < cum) return gifts[i];
  }
  return gifts[gifts.length - 1];
}
