export interface PrescribedDrug {
  slot: number;
  id: string;
  name: string;
  classes: string[];
  isSelfPay: boolean;
  /** BID(1일 2회) 처방 여부 — 효과 2배로 계산됨 */
  bid?: boolean;
}

export type ComorbFeedbackType = 'good' | 'bad';

export interface ComorbFeedbackEntry {
  type: ComorbFeedbackType;
  msg: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  prescribedDrugs: PrescribedDrug[];
  insuranceCodes: string[];
  oldHba1c: number;
  newHba1c: number;
  oldWeight: number;
  newWeight: number;
  oldLvef: number | '';
  newLvef: number | '';
  oldNyha: number | '';
  newNyha: number | '';
  oldBnp: number | '';
  newBnp: number | '';
  oldNtprobnp: number | '';
  newNtprobnp: number | '';
  oldEgfr: number | '';
  newEgfr: number | '';
  oldUacr: number | '';
  newUacr: number | '';
  sideEffects: string[];
  deductionReasons: string[];
  patientFeedback: string;
  comorbFeedback: Record<string, ComorbFeedbackEntry>;
  isPackagingBonus: boolean;
  isPoorAdherence: boolean;
  timestamp: string;
  oldCustomMetrics?: Record<string, number | ''>;
  newCustomMetrics?: Record<string, number | ''>;
}

export interface RxSession {
  id: string;
  hospitalName: string;
  doctorName: string;
  /** 병원 선택 시 분과명. 의원 선택 시 빈 문자열. */
  department?: string;
  institutionType?: '병원' | '의원';
  sessionKey: string;
  createdAt: string;
  prescriptions: Prescription[];
  loginFieldValues?: Record<string, string>;
  /** 담당자 사번. 조회를 서버 where 쿼리로 좁히기 위한 인덱스 필드. (없을 수 있음) */
  empNo?: string;
}

export interface PrescriptionResult {
  prescription: Prescription;
  current: {
    hba1c: number;
    weight: number;
    lvef: number;
    nyha: number;
    bnp: number;
    ntprobnp: number;
    egfr: number;
    uacr: number;
    customMetrics?: Record<string, number>;
  };
}
