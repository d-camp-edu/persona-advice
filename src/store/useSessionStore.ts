import { create } from 'zustand';
import { makeSessionDocId, makeSessionKey } from '../lib/sessionKey';
import { getPatientCurrentState } from '../lib/patientState';
import { calculatePrescription } from '../lib/prescription';
import { checkDeductions } from '../lib/deductions';
import { checkNonDmCoverage } from '../lib/nonDmCoverage';
import { loadLatestRxSession, saveRxSession } from '../lib/sessionRepo';
import { saveDoc } from '../lib/firestoreApi';
import type { Medication, Prescription, PrescriptionResult, RxSession, SurveyResponse } from '../types';
import { useDataStore } from './useDataStore';

export type Phase = 'login' | 'survey' | 'select' | 'rx' | 'result' | 'admin' | 'myresults';
export type RxPhase = 'menu' | 'chart' | 'prescribe' | 'result';

export type ComorbFilter = string;

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
  sessionCreatedAt: string;
  loginFieldValues: Record<string, string>;

  currentPatientId: string | null;
  slots: Slots;
  diagCodes: string[];
  comorbFilter: ComorbFilter;

  sessionPrescriptions: Prescription[];
  lastResult: PrescriptionResult | null;
  loginPending: boolean;

  login: (fieldValues: Record<string, string>) => Promise<void>;
  completeSurvey: (answers: Record<string, string | string[]>) => Promise<void>;
  goMyResults: () => void;
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
  loginFieldValues: {},

  currentPatientId: null,
  slots: emptySlots(),
  diagCodes: [],
  comorbFilter: '전체',

  sessionPrescriptions: [],
  lastResult: null,
  loginPending: false,

  login: async (fieldValues) => {
    const h = (fieldValues['hospital'] ?? '').trim();
    const d = (fieldValues['doctor'] ?? '').trim();
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

    const surveyQuestions = useDataStore.getState().surveyQuestions;
    const nextPhase: Phase = surveyQuestions.length > 0 ? 'survey' : 'select';

    set({
      hospitalName: h,
      doctorName: d,
      sessionKey: key,
      sessionDocId,
      sessionCreatedAt,
      sessionPrescriptions,
      loginFieldValues: fieldValues,
      phase: nextPhase,
      comorbFilter: '전체',
      currentPatientId: null,
      loginPending: false,
      lastResult: null,
    });
  },

  completeSurvey: async (answers) => {
    const { sessionDocId, doctorName, hospitalName, loginFieldValues } = get();
    const response: Omit<SurveyResponse, 'id'> = {
      sessionDocId,
      doctorName,
      hospitalName,
      answeredAt: new Date().toISOString(),
      answers,
      loginFieldValues,
    };
    try {
      await saveDoc('surveyResponses', sessionDocId, response as unknown as Record<string, unknown>);
    } catch (e) {
      console.warn('[survey] save failed', e);
    }
    set({ phase: 'select' });
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
      loginFieldValues,
    } = get();
    if (!currentPatientId) return;
    const patient = data.patients.find((p) => p.id === currentPatientId);
    if (!patient) return;

    const slotMeds = slots.map((id) =>
      id ? data.medications.find((m) => m.id === id) ?? null : null,
    );

    const current = getPatientCurrentState(patient, sessionPrescriptions, data.medications, data.patientMetricDefs);
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
      patientMetricDefs: data.patientMetricDefs,
    });

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
        loginFieldValues,
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
      loginFieldValues: {},
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
  goMyResults: () => set({ phase: 'myresults' }),
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
