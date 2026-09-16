import { describe, it, expect } from 'vitest';
import {
  campaignPeriodStatus,
  isCampaignOpen,
  todayLocalISO,
} from '../src/lib/campaignPeriod';

const c = (active: boolean, startDate: string, endDate: string) => ({
  active,
  startDate,
  endDate,
});

describe('campaignPeriodStatus', () => {
  it('비활성이면 기간과 무관하게 inactive', () => {
    expect(campaignPeriodStatus(c(false, '2026-01-01', '2026-12-31'), '2026-06-01')).toBe('inactive');
  });

  it('기간 안이면 open (양끝 포함)', () => {
    expect(campaignPeriodStatus(c(true, '2026-06-01', '2026-06-30'), '2026-06-15')).toBe('open');
    expect(campaignPeriodStatus(c(true, '2026-06-01', '2026-06-30'), '2026-06-01')).toBe('open');
    expect(campaignPeriodStatus(c(true, '2026-06-01', '2026-06-30'), '2026-06-30')).toBe('open');
  });

  it('시작 전은 upcoming, 종료 후는 ended', () => {
    expect(campaignPeriodStatus(c(true, '2026-06-01', '2026-06-30'), '2026-05-31')).toBe('upcoming');
    expect(campaignPeriodStatus(c(true, '2026-06-01', '2026-06-30'), '2026-07-01')).toBe('ended');
  });

  it('날짜가 비어 있으면 그 방향은 제한 없음 (기존 데이터 호환)', () => {
    expect(isCampaignOpen(c(true, '', ''), '2026-06-15')).toBe(true);
    expect(isCampaignOpen(c(true, '', '2026-06-30'), '2026-07-01')).toBe(false);
    expect(isCampaignOpen(c(true, '', '2026-06-30'), '2026-06-30')).toBe(true);
    expect(isCampaignOpen(c(true, '2026-06-01', ''), '2026-05-31')).toBe(false);
    expect(isCampaignOpen(c(true, '2026-06-01', ''), '2030-01-01')).toBe(true);
  });

  it('형식이 잘못된 날짜는 제한 없음으로 취급', () => {
    expect(isCampaignOpen(c(true, '2026/06/01', '엉터리'), '2020-01-01')).toBe(true);
  });

  it('종료일을 미래로 고치면 다시 open', () => {
    const ended = c(true, '2026-06-01', '2026-06-30');
    expect(isCampaignOpen(ended, '2026-09-16')).toBe(false);
    expect(isCampaignOpen({ ...ended, endDate: '2026-12-31' }, '2026-09-16')).toBe(true);
  });
});

describe('todayLocalISO', () => {
  it('로컬 기준 YYYY-MM-DD (UTC 변환으로 날짜가 밀리지 않는다)', () => {
    expect(todayLocalISO(new Date(2026, 8, 16, 23, 30))).toBe('2026-09-16');
    expect(todayLocalISO(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});
