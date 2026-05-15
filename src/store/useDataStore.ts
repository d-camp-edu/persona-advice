import { create } from 'zustand';
import type { Unsubscribe } from 'firebase/firestore';
import type {
  Patient,
  Medication,
  MedCategory,
  DrugClass,
  GlobalSettings,
  DeductionRule,
  AllowedCombination,
  SideEffectExemption,
  SurveyQuestion,
  PatientMetricDef,
} from '../types';
import {
  seedPatients,
  seedMedications,
  seedMedCategories,
  seedDrugClasses,
  seedSettings,
  seedSurveyQuestions,
  seedPatientMetricDefs,
} from '../data/seed';
import { subscribeCollection, subscribeDoc } from '../lib/firestoreApi';
import { ensureAnonymousAuth, isFirebaseConfigured } from '../lib/firebase';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DataState {
  patients: Patient[];
  medications: Medication[];
  medCategories: MedCategory[];
  drugClasses: DrugClass[];
  deductionRules: DeductionRule[];
  allowedCombinations: AllowedCombination[];
  sideEffectExemptions: SideEffectExemption[];
  settings: GlobalSettings;
  surveyQuestions: SurveyQuestion[];
  patientMetricDefs: PatientMetricDef[];

  status: LoadStatus;
  error: string | null;
  /** Firebase 미구성 또는 빈 컬렉션이라 시드를 그대로 보여주는 fallback 모드 */
  isUsingSeedFallback: boolean;

  bootstrap: () => Promise<void>;
  unsubscribeAll: () => void;

  getMedById: (id: string) => Medication | undefined;
  getPatientById: (id: string) => Patient | undefined;
}

const subs: Unsubscribe[] = [];

export const useDataStore = create<DataState>((set, get) => ({
  patients: seedPatients,
  medications: seedMedications,
  medCategories: seedMedCategories,
  drugClasses: seedDrugClasses,
  deductionRules: [],
  allowedCombinations: [],
  sideEffectExemptions: [],
  settings: seedSettings,
  surveyQuestions: seedSurveyQuestions,
  patientMetricDefs: seedPatientMetricDefs,

  status: 'idle',
  error: null,
  isUsingSeedFallback: true,

  bootstrap: async () => {
    const cur = get().status;
    if (cur === 'loading' || cur === 'ready') return;
    set({ status: 'loading', error: null });

    if (!isFirebaseConfigured()) {
      set({ status: 'ready', isUsingSeedFallback: true });
      return;
    }

    try {
      await ensureAnonymousAuth();

      subs.push(
        subscribeCollection<Patient>('patients', (items) => {
          if (items.length === 0) return;
          set({ patients: items, isUsingSeedFallback: false });
        }),
      );
      subs.push(
        subscribeCollection<Medication>('medications', (items) => {
          if (items.length === 0) return;
          set({ medications: items, isUsingSeedFallback: false });
        }),
      );
      subs.push(
        subscribeCollection<MedCategory>('medCategories', (items) => {
          if (items.length === 0) return;
          set({ medCategories: items });
        }),
      );
      subs.push(
        subscribeCollection<DrugClass>('drugClasses', (items) => {
          if (items.length === 0) return;
          set({ drugClasses: items });
        }),
      );
      subs.push(
        subscribeCollection<DeductionRule>('deductionRules', (items) => {
          set({ deductionRules: items });
        }),
      );
      subs.push(
        subscribeCollection<AllowedCombination>('allowedCombinations', (items) => {
          set({ allowedCombinations: items });
        }),
      );
      subs.push(
        subscribeCollection<SideEffectExemption>('sideEffectExemptions', (items) => {
          set({ sideEffectExemptions: items });
        }),
      );
      subs.push(
        subscribeDoc<GlobalSettings>('settings', 'global', (data) => {
          if (data) set({ settings: data });
        }),
      );
      subs.push(
        subscribeCollection<SurveyQuestion>('surveyQuestions', (items) => {
          // Firebase 연결 시 항상 실데이터 우선 (빈 배열이면 서베이 미표시)
          set({ surveyQuestions: items });
        }),
      );
      subs.push(
        subscribeCollection<PatientMetricDef>('patientMetricDefs', (items) => {
          if (items.length === 0) return;
          set({ patientMetricDefs: items });
        }),
      );

      set({ status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  unsubscribeAll: () => {
    while (subs.length) {
      const u = subs.pop();
      try {
        u?.();
      } catch {
        /* noop */
      }
    }
  },

  getMedById: (id) => get().medications.find((m) => m.id === id),
  getPatientById: (id) => get().patients.find((p) => p.id === id),
}));
