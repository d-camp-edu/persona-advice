// 영업부 배포용 타겟처(지정처) 관리 도메인 타입.
//   - TargetCampaign: 진행기간 캠페인(월별 대시보드 기준)
//   - Target        : 담당자 사번에 배정된 개별 거래처(지정처)
//   - TargetCompletion: 서베이 완료 = 지정처 1건 진행 완료 기록

export type TargetInstitution = '병원' | '의원';

/** 품목(자사 제품). 로그인 1단계에서 담당자가 먼저 선택한다. */
export interface Product {
  id: string;
  name: string;
  order: number;
  active: boolean;
}

export interface TargetCampaign {
  id: string;
  name: string;
  /** 이 캠페인이 속한 품목 id (없으면 품목 무관) */
  productId?: string;
  /** 대시보드 월별 집계 기준 'YYYY-MM' */
  month: string;
  /** 진행기간 시작/종료 'YYYY-MM-DD' (표시·필터용, 강제 차단은 안 함) */
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
}

export interface Target {
  id: string;
  campaignId: string;
  code: string; // 거래처코드
  name: string; // 거래처명
  institutionType: TargetInstitution;
  drName: string; // 병원 Dr.명 (의원은 '')
  division: string; // 사업부명
  team: string; // 팀명
  empNo: string; // 담당자 사번
  empName: string; // 담당자명 (병원 포맷에 없으면 '')
}

export interface TargetCompletion {
  id: string; // `${campaignId}__${targetId}` — 1지정처 1완료
  campaignId: string;
  productId?: string;
  productName?: string;
  targetId: string;
  code: string;
  name: string;
  institutionType: TargetInstitution;
  empNo: string;
  empName: string;
  empPhone: string; // 담당자 연락처 (리워드 발송용)
  division: string;
  team: string;
  doctorName: string;
  completedAt: string; // ISO
}
