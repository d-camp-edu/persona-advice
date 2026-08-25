/** 캠페인(진행기간) 하나에 대한 선물 확률 오버라이드 */
export interface GiftCampaignProb {
  hospital: number;
  clinic: number;
}

export interface Gift {
  id: string;
  name: string;
  imageUrl: string;
  /** 기본 확률(%) — 캠페인별 오버라이드가 없을 때 사용 */
  probHospital: number;
  probClinic: number;
  /**
   * 캠페인(진행기간)별 확률 오버라이드. key = TargetCampaign.id.
   * 값이 있는 캠페인에서만 기본 확률 대신 사용한다.
   * 없거나 해당 캠페인 키가 없으면 기존과 동일하게 probHospital/probClinic 사용.
   */
  campaignProbs?: Record<string, GiftCampaignProb>;
  order: number;
}

/** 룰렛(선물 보상) 1회 실행 결과 로그 */
export interface GiftLog {
  id: string;
  sessionDocId: string;
  sessionKey: string;
  hospitalName: string;
  doctorName: string;
  department?: string;
  institutionType?: '병원' | '의원';
  patientId: string;
  patientName: string;
  /** 당첨된 선물 id. 꽝이면 빈 문자열 */
  giftId: string;
  /** 당첨된 선물 이름. 꽝이면 '꽝' */
  giftName: string;
  isWin: boolean;
  spunAt: string;
  loginFieldValues?: Record<string, string>;
}
