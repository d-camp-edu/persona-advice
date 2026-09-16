// 캠페인(진행기간) 노출 판정. 순수 함수 — Firestore/React 의존 없음.
//
// 로그인 화면(타겟처 검색)에 캠페인이 뜨려면 두 조건을 모두 만족해야 한다.
//   ① active === true  (관리자 토글)
//   ② 오늘이 startDate ~ endDate 안 (양끝 포함)
//
// 날짜가 비어 있으면 그 방향은 제한 없음으로 본다. 날짜를 넣지 않고 운영해 온
// 기존 캠페인은 지금까지와 똑같이 계속 노출된다(기존 데이터 무변경).
//
// 판정은 저장값이 아니라 '지금' 계산하므로, 관리자가 종료일을 미래로 고치면
// 그 즉시 다시 노출된다(별도 복구 작업 불필요).

import type { TargetCampaign } from '../types';

export type CampaignPeriodStatus =
  | 'inactive' // 비활성 토글
  | 'upcoming' // 시작 전
  | 'open' // 진행 중 → 로그인 노출
  | 'ended'; // 기간 종료

/** 로컬 기준 오늘 날짜 'YYYY-MM-DD' (input[type=date] 저장 형식과 동일) */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' 형태만 인정. 그 외(빈칸·잘못된 값)는 '제한 없음'으로 취급. */
function normDate(v: string | undefined): string {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

type PeriodInput = Pick<TargetCampaign, 'active' | 'startDate' | 'endDate'>;

export function campaignPeriodStatus(
  c: PeriodInput,
  today: string = todayLocalISO(),
): CampaignPeriodStatus {
  if (!c.active) return 'inactive';
  const start = normDate(c.startDate);
  const end = normDate(c.endDate);
  // 'YYYY-MM-DD' 는 사전순 비교가 곧 날짜순 비교다.
  if (start && today < start) return 'upcoming';
  if (end && today > end) return 'ended';
  return 'open';
}

/** 로그인 화면에 노출할 캠페인인가 */
export function isCampaignOpen(c: PeriodInput, today: string = todayLocalISO()): boolean {
  return campaignPeriodStatus(c, today) === 'open';
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignPeriodStatus, string> = {
  inactive: '비활성',
  upcoming: '시작 전',
  open: '진행 중',
  ended: '기간 종료',
};
