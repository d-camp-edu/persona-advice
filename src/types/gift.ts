export interface Gift {
  id: string;
  name: string;
  imageUrl: string;
  probHospital: number;
  probClinic: number;
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
