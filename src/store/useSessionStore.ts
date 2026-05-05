import { create } from 'zustand';
import { makeSessionKey } from '../lib/sessionKey';

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

  currentPatientId: string | null;
  slots: Slots;
  diagCodes: string[];
  comorbFilter: ComorbFilter;

  login: (hospital: string, doctor: string) => void;
  selectPatient: (id: string) => void;
  setComorbFilter: (filter: ComorbFilter) => void;
  setSlot: (idx: number, medId: string | null) => void;
  clearSlot: (idx: number) => void;
  toggleDiag: (code: string) => void;
  setRxPhase: (p: RxPhase) => void;
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

  currentPatientId: null,
  slots: emptySlots(),
  diagCodes: [],
  comorbFilter: '전체',

  login: (hospital, doctor) => {
    const h = hospital.trim();
    const d = doctor.trim();
    if (!h || !d) return;
    const key = makeSessionKey(h, d);
    set({
      hospitalName: h,
      doctorName: d,
      sessionKey: key,
      phase: 'select',
      comorbFilter: '전체',
      currentPatientId: null,
    });
  },

  selectPatient: (id) => {
    set({
      currentPatientId: id,
      slots: emptySlots(),
      diagCodes: [],
      rxPhase: 'menu',
      phase: 'rx',
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

  resetToSelect: () => {
    set({
      phase: 'select',
      rxPhase: 'menu',
      currentPatientId: null,
      slots: emptySlots(),
      diagCodes: [],
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
      currentPatientId: null,
      slots: emptySlots(),
      diagCodes: [],
      comorbFilter: '전체',
    });
  },

  goAdmin: () => set({ phase: 'admin' }),
  exitAdmin: () => set({ phase: 'login' }),
}));
