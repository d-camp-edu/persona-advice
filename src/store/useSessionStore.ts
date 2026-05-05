import { create } from 'zustand';
import { makeSessionDocId, makeSessionKey } from '../lib/sessionKey';
import { getPatientCurrentState } from '../lib/patientState';
import { calculatePrescription } from '../lib/prescription';
import { checkDeductions } from '../lib/deductions';
import { checkNonDmCoverage } from '../lib/nonDmCoverage';
import { loadLatestRxSession, saveRxSession } from '../lib/sessionRepo';
import type { Medication, Prescription, PrescriptionResult, RxSession } from '../types';
import { useDataStore } from './useDataStore';

export type Phase = 'login' | 'select' | 'rx' | 'result' | 'admin';
export type RxPhase = 'menu' | 'chart' | 'prescribe' | 'result';

export type ComorbFilter = string; // '전체' 또는 공병증 이름

type Slot = string | null;
type Slots = [Slot, Slot, Slot, Slot, Slot];

const emptySlots = (): Slots => [null, null, null, null, null];

interface SessionState {
  phase: Phase;
  rxPhase: RxPhase;

  hospitalName: string;
  doctorName: string;
  sessionKey: string;
  sessionDocId: string;
  /** 세션 doc 최초 생성 시각(ISO). 동일 doc을 덮어쓸 때 보존된다. */
  sessionCreatedAt: string;

  currentPatientId: string | null;
  slots: Slots;
  diagCodes: string[];
  comorbFilter: ComorbFilter;

  /** 같은 시연 세션 내 누적 처방. Firestore rx_sessions와 동기화. */
  sessionPrescriptions: Prescription[];
  /** 직전 처방 시뮬레이션 결과. result 화면에서 사용. */
  lastResult: PrescriptionResult | null;
  /** 로그인 진행 중 플래그(Firestore carryover 조회 동안). */
  loginPending: boolean;

  login: (hospital: string, doctor: string) => Promise<void>;
  selectPatient: (id: string) => void;
  setComorbFilter: (filter: ComorbFilter) => void;
  setSlot: (idx: number, medId: string | null) => void;
  clearSlot: (idx: number) => void;
  toggleDiag: (code: string) => void;
  setRxPhase: (p: RxPhase) => void;
  confirmPrescription: () => void;
  resetToSelect: () => void;
  resetToLogin: () => void;
  goAdmin: () => void;
  exitAdmin: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  phase: 'login',
  rxPhase: 'menu',

  hospitalName: '',
  doctorName: '',
  sessionKey: '',
  sessionDocId: '',
  sessionCreatedAt: '',

  currentPatientId: null,
  slots: emptySlots(),
  diagCodes: [],
  comorbFilter: '전체',

  sessionPrescriptions: [],
  lastResult: null,
  loginPending: false,

  login: async (hospital, doctor) => {
    const h = hospital.trim();
    const d = doctor.trim();
    if (!h || !d) return;
    if (get().loginPending) return;
    const key = makeSessionKey(h, d);

    set({ loginPending: true });

    const settings = useDataStore.getState().settings;
    let sessionDocId = '';
    let sessionCreatedAt = '';
    let sessionPrescriptions: Prescription[] = [];

    if (settings.allowSessionCarryover) {
      try {
        const existing = await loadLatestRxSession(key);
        if (existing) {
          sessionDocId = existing.id;
          sessionCreatedAt = existing.createdAt;
          sessionPrescriptions = existing.prescriptions ?? [];
        }
      } catch (e) {
        console.warn('[session] carryover load failed; starting fresh', e);
      }
    }

    if (!sessionDocId) {
      const now = Date.now();
      sessionDocId = makeSessionDocId(key, now);
      sessionCreatedAt = new Date(now).toISOString();
    }

    set({
      hospitalName: h,
      doctorName: d,
      sessionKey: key,
      sessionDocId,
      sessionCreatedAt,
      sessionPrescriptions,
      phase: 'select',
      comorbFilter: '전체',
      currentPatientId: null,
      loginPending: false,
      lastResult: null,
    });
  },

  selectPatient: (id) => {
    set({
      currentPatientId: id,
      slots: emptySlots(),
      diagCodes: [],
      rxPhase: 'menu',
      phase: 'rx',
      lastResult: null,
    });
  },

  setComorbFilter: (filter) => set({ comorbFilter: filter }),

  setSlot: (idx, medId) => {
    if (idx < 0 || idx > 4) return;
    const next = [...get().slots] as Slots;
    next[idx] = medId;
    set({ slots: next });
  },

  clearSlot: (idx) => {
    if (idx < 0 || idx > 4) return;
    const next = [...get().slots] as Slots;
    next[idx] = null;
    set({ slots: next });
  },

  toggleDiag: (code) => {
    const cur = get().diagCodes;
    set({
      diagCodes: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code],
    });
  },

  setRxPhase: (p) => set({ rxPhase: p }),

  confirmPrescription: () => {
    const data = useDataStore.getState();
    const {
      currentPatientId,
      slots,
      diagCodes,
      sessionPrescriptions,
      hospitalName,
      doctorName,
      sessionKey,
      sessionDocId,
      sessionCreatedAt,
    } = get();
    if (!currentPatientId) return;
    const patient = data.patients.find((p) => p.id === currentPatientId);
    if (!patient) return;

    const slotMeds = slots.map((id) =>
      id ? data.medications.find((m) => m.id === id) ?? null : null,
    );

    const current = getPatientCurrentState(patient, sessionPrescriptions, data.medications);
    const pastSideEffectCounts = countPastSideEffects(
      sessionPrescriptions,
      patient.id,
      data.medications,
    );

    const result = calculatePrescription({
      patient,
      current,
      slots: slotMeds,
      diagCodes,
      settings: data.settings,
      exemptions: data.sideEffectExemptions,
      pastSideEffectCounts,
    });

    // 비당뇨 SGLT-2i 특례 미충족 → 보험슬롯(1~3)도 자가부담으로 전환
    const nonDmReasons: string[] = [];
    const insuranceSlotMeds: Medication[] = [];
    for (const drug of result.prescription.prescribedDrugs) {
      const med = data.medications.find((m) => m.id === drug.id);
      if (!med) continue;
      if (drug.slot >= 4) continue;
      const cov = checkNonDmCoverage(patient, med, data.settings);
      if (!cov.notApplicable && !cov.covered) {
        drug.isSelfPay = true;
        nonDmReasons.push(`${drug.name}: ${cov.reason}`);
        continue;
      }
      // 자가부담으로 전환된 약은 보험 삭감 대상에서 제외.
      insuranceSlotMeds.push(med);
    }

    const deductionReasons = checkDeductions(
      insuranceSlotMeds,
      diagCodes,
      current.hba1c,
      data.deductionRules,
      data.allowedCombinations,
      data.settings,
    );
    result.prescription.deductionReasons = [...deductionReasons, ...nonDmReasons];

    const nextPrescriptions = [...sessionPrescriptions, result.prescription];

    set({
      sessionPrescriptions: nextPrescriptions,
      lastResult: result,
      phase: 'result',
      rxPhase: 'menu',
    });

    if (sessionDocId) {
      const session: RxSession = {
        id: sessionDocId,
        hospitalName,
        doctorName,
        sessionKey,
        createdAt: sessionCreatedAt || new Date().toISOString(),
        prescriptions: nextPrescriptions,
      };
      void saveRxSession(session).catch((e) => {
        console.warn('[session] saveRxSession failed', e);
      });
    }
  },

  resetToSelect: () => {
    set({
      phase: 'select',
      rxPhase: 'menu',
      currentPatientId: null,
      slots: emptySlots(),
      diagCodes: [],
      lastResult: null,
    });
  },

  resetToLogin: () => {
    set({
      phase: 'login',
      rxPhase: 'menu',
      hospitalName: '',
      doctorName: '',
      sessionKey: '',
      sessionDocId: '',
      sessionCreatedAt: '',
      currentPatientId: null,
      slots: emptySlots(),
      diagCodes: [],
      comorbFilter: '전체',
      sessionPrescriptions: [],
      lastResult: null,
    });
  },

  goAdmin: () => set({ phase: 'admin' }),
  exitAdmin: () => set({ phase: 'login' }),
}));

function countPastSideEffects(
  prescriptions: Prescription[],
  patientId: string,
  meds: Medication[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of prescriptions) {
    if (p.patientId !== patientId) continue;
    for (const drug of p.prescribedDrugs) {
      const fired = p.sideEffects.some((s) => s.startsWith(`[${drug.name}]`));
      if (!fired) continue;
      const med = meds.find((m) => m.id === drug.id);
      if (!med) continue;
      for (const c of med.worseningComorb) {
        counts[c] = (counts[c] ?? 0) + 1;
      }
    }
  }
  return counts;
}
