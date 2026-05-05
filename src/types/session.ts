export interface PrescribedDrug {
  slot: number;
  id: string;
  name: string;
  classes: string[];
  isSelfPay: boolean;
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
}

export interface RxSession {
  id: string;
  hospitalName: string;
  doctorName: string;
  sessionKey: string;
  createdAt: string;
  prescriptions: Prescription[];
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
  };
}
