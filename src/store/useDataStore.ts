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
  Gift,
  TargetCampaign,
  Product,
} from '../types';
import {
  seedPatients,
  seedMedications,
  seedMedCategories,
  seedDrugClasses,
  seedSettings,
  seedSurveyQuestions,
  seedPatientMetricDefs,
  seedGifts,
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
  gifts: Gift[];
  targetCampaigns: TargetCampaign[];
  products: Product[];

  status: LoadStatus;
  error: string | null;
  /** Firebase 미구성 또는 빈 컬렉션이라 시드를 그대로 보여주는 fallback 모드 */
  isUsingSeedFallback: boolean;

  /**
   * 각 폴백 컬렉션이 DB에서 "비어 있음(=시드를 화면에 띄우는 중)"인지 여부.
   * true면 단일 문서 저장 시 시드 전체를 먼저 batch 업로드해야 한다.
   * (그렇지 않으면 1개만 저장돼 나머지 60종이 통째로 사라진다)
   */
  medsEmpty: boolean;
  medCategoriesEmpty: boolean;
  drugClassesEmpty: boolean;

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
  gifts: seedGifts,
  targetCampaigns: [],
  products: [],

  status: 'idle',
  error: null,
  isUsingSeedFallback: true,
  medsEmpty: true,
  medCategoriesEmpty: true,
  drugClassesEmpty: true,

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

      // settings/global 문서가 처음 도착할 때까지 ready 전환을 보류한다.
      // 그렇지 않으면 시드 기본값으로 한 프레임 그려진 뒤 사용자 저장 설정이
      // 뒤늦게 덮어쓰는 깜빡임이 발생한다.
      let settingsArrived = false;
      const markReadyIfSettings = () => {
        if (!settingsArrived) return;
        if (get().status !== 'ready') set({ status: 'ready' });
      };

      subs.push(
        // 환자는 빈 배열도 그대로 반영한다. Firebase가 구성된 경우에만 구독하므로
        // 빈 스냅샷 = "DB에 환자가 실제로 0명"이라는 뜻이라 시드로 되돌리지 않는다.
        // (약제·카테고리 등은 시뮬레이터 동작을 위해 빈 컬렉션이면 시드 폴백 유지)
        subscribeCollection<Patient>('patients', (items) => {
          set({ patients: items, isUsingSeedFallback: false });
        }),
      );
      subs.push(
        subscribeCollection<Medication>('medications', (items) => {
          if (items.length === 0) {
            set({ medsEmpty: true });
            return;
          }
          set({ medications: items, isUsingSeedFallback: false, medsEmpty: false });
        }),
      );
      subs.push(
        subscribeCollection<MedCategory>('medCategories', (items) => {
          if (items.length === 0) {
            set({ medCategoriesEmpty: true });
            return;
          }
          set({ medCategories: items, medCategoriesEmpty: false });
        }),
      );
      subs.push(
        subscribeCollection<DrugClass>('drugClasses', (items) => {
          if (items.length === 0) {
            set({ drugClassesEmpty: true });
            return;
          }
          set({ drugClasses: items, drugClassesEmpty: false });
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
          settingsArrived = true;
          markReadyIfSettings();
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
      subs.push(
        subscribeCollection<Gift>('gifts', (items) => {
          set({ gifts: items });
        }),
      );
      subs.push(
        subscribeCollection<TargetCampaign>('targetCampaigns', (items) => {
          set({ targetCampaigns: items });
        }),
      );
      subs.push(
        subscribeCollection<Product>('products', (items) => {
          set({ products: items });
        }),
      );

      // 안전망: settings 구독이 어떤 이유로든 4초 안에 도달하지 못하면
      // (예: 네트워크 지연이 아닌 권한 문제) 시드값으로라도 화면을 표시한다.
      setTimeout(() => {
        if (!settingsArrived) {
          settingsArrived = true;
          markReadyIfSettings();
        }
      }, 4000);
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
