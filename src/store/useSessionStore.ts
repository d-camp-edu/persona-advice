import { create } from 'zustand';
import { makeSessionDocId, makeSessionKey } from '../lib/sessionKey';
import { getPatientCurrentState } from '../lib/patientState';
import { surveyQuestionsForPatient } from '../lib/surveyScope';
import { calculatePrescription } from '../lib/prescription';
import { checkDeductions } from '../lib/deductions';
import { checkNonDmCoverage } from '../lib/nonDmCoverage';
import { loadLatestRxSession, saveRxSession } from '../lib/sessionRepo';
import { saveDoc } from '../lib/firestoreApi';
import { saveGiftLog } from '../lib/logsRepo';
import { saveTargetCompletion } from '../lib/targetsRepo';
import type { Gift, GiftLog, Medication, Prescription, PrescriptionResult, RxSession, SurveyResponse, Target, TargetCampaign, TargetCompletion } from '../types';
import { useDataStore } from './useDataStore';

export type Phase = 'login' | 'survey' | 'select' | 'rx' | 'result' | 'admin' | 'myresults';
export type RxPhase = 'menu' | 'chart' | 'prescribe' | 'result';
export type InstitutionType = '병원' | '의원';

export type ComorbFilter = string;

type Slot = string | null;
type Slots = [Slot, Slot, Slot, Slot, Slot];
type Bids = [boolean, boolean, boolean, boolean, boolean];

const emptySlots = (): Slots => [null, null, null, null, null];
const emptyBids = (): Bids => [false, false, false, false, false];

/** 환자가 현재 복용 중인 약(prevDrugs medId 배열)을 5칸 처방 슬롯으로 변환 */
const slotsFromPrevDrugs = (prevDrugs?: string[]): Slots => {
  const s = emptySlots();
  if (Array.isArray(prevDrugs)) {
    for (let i = 0; i < 5; i += 1) {
      const id = prevDrugs[i];
      s[i] = id && id.length > 0 ? id : null;
    }
  }
  return s;
};

interface SessionState {
  phase: Phase;
  rxPhase: RxPhase;

  hospitalName: string;
  doctorName: string;
  institutionType: InstitutionType;
  department: string;
  sessionKey: string;
  sessionDocId: string;
  sessionCreatedAt: string;
  loginFieldValues: Record<string, string>;

  // 타겟처 배포: 사번으로 지정처를 선택해 시작한 세션이면 채워진다 (없으면 '')
  targetId: string;
  targetCode: string;
  campaignId: string;
  empNo: string;
  empName: string;
  division: string;
  team: string;

  currentPatientId: string | null;
  slots: Slots;
  slotBids: Bids;
  diagCodes: string[];
  comorbFilter: ComorbFilter;

  sessionPrescriptions: Prescription[];
  lastResult: PrescriptionResult | null;
  loginPending: boolean;

  /** '서베이만 진행' 모드: 환자 없이 공통 질문만 진행하고 끝나면 환자 선택으로 복귀 */
  surveyOnly: boolean;
  /** survey-only 완료 직후 환자 선택 화면에 표시할 확인 배너 */
  surveyOnlyDone: boolean;

  login: (
    fieldValues: Record<string, string>,
    institutionType: InstitutionType,
    department: string,
  ) => Promise<void>;
  completeSurvey: (answers: Record<string, string | string[]>) => Promise<void>;
  loginWithTarget: (target: Target, campaign: TargetCampaign) => void;
  startSurveyOnly: () => void;
  dismissSurveyOnlyDone: () => void;
  goMyResults: () => void;
  selectPatient: (id: string) => void;
  logGiftSpin: (gift: Gift | null) => void;
  setComorbFilter: (filter: ComorbFilter) => void;
  setSlot: (idx: number, medId: string | null) => void;
  clearSlot: (idx: number) => void;
  toggleSlotBid: (idx: number) => void;
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
  institutionType: '병원',
  department: '',
  sessionKey: '',
  sessionDocId: '',
  sessionCreatedAt: '',
  loginFieldValues: {},

  targetId: '',
  targetCode: '',
  campaignId: '',
  empNo: '',
  empName: '',
  division: '',
  team: '',

  currentPatientId: null,
  slots: emptySlots(),
  slotBids: emptyBids(),
  diagCodes: [],
  comorbFilter: '전체',

  sessionPrescriptions: [],
  lastResult: null,
  loginPending: false,
  surveyOnly: false,
  surveyOnlyDone: false,

  login: async (fieldValues, institutionType, department) => {
    const h = (fieldValues['hospital'] ?? '').trim();
    const d = (fieldValues['doctor'] ?? '').trim();
    const dept = institutionType === '병원' ? (department ?? '').trim() : '';
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

    try {
      localStorage.setItem('persona_rx_last_login', JSON.stringify(fieldValues));
    } catch {
      // ignore storage errors
    }

    // 서베이는 더 이상 로그인 직후에 하지 않는다. 환자를 선택할 때마다 진행한다.
    set({
      hospitalName: h,
      doctorName: d,
      institutionType,
      department: dept,
      sessionKey: key,
      sessionDocId,
      sessionCreatedAt,
      sessionPrescriptions,
      loginFieldValues: fieldValues,
      phase: 'select',
      comorbFilter: '전체',
      currentPatientId: null,
      loginPending: false,
      lastResult: null,
      surveyOnly: false,
      surveyOnlyDone: false,
      // 직접 입력 로그인은 타겟처 세션이 아니다.
      targetId: '',
      targetCode: '',
      campaignId: '',
      empNo: '',
      empName: '',
      division: '',
      team: '',
    });
  },

  // 타겟처(지정처) 선택으로 세션 시작. 거래처명=병원, Dr.명(병원)/거래처명(의원)=의사.
  loginWithTarget: (target, campaign) => {
    const doctor = (target.drName || target.name || '').trim();
    const hospital = (target.name || target.code || '').trim();
    const key = makeSessionKey(hospital, doctor);
    const now = Date.now();
    const sessionDocId = makeSessionDocId(key, now);
    set({
      hospitalName: hospital,
      doctorName: doctor,
      institutionType: target.institutionType,
      department: '',
      sessionKey: key,
      sessionDocId,
      sessionCreatedAt: new Date(now).toISOString(),
      sessionPrescriptions: [],
      loginFieldValues: { hospital, doctor, 사번: target.empNo, 담당자: target.empName },
      targetId: target.id,
      targetCode: target.code,
      campaignId: campaign.id,
      empNo: target.empNo,
      empName: target.empName,
      division: target.division,
      team: target.team,
      phase: 'select',
      comorbFilter: '전체',
      currentPatientId: null,
      lastResult: null,
      loginPending: false,
      surveyOnly: false,
      surveyOnlyDone: false,
    });
  },

  // 서베이 완료 → survey-only면 환자 선택으로 복귀, 아니면 처방 시뮬레이션(rx)으로 진입
  completeSurvey: async (answers) => {
    const {
      sessionDocId,
      doctorName,
      hospitalName,
      department,
      institutionType,
      loginFieldValues,
      currentPatientId,
      surveyOnly,
    } = get();
    const patient = useDataStore.getState().patients.find((p) => p.id === currentPatientId);
    const response: Omit<SurveyResponse, 'id'> = {
      sessionDocId,
      doctorName,
      hospitalName,
      department,
      institutionType,
      patientId: currentPatientId ?? '',
      patientName: patient?.name ?? '',
      answeredAt: new Date().toISOString(),
      answers,
      loginFieldValues,
    };
    // 환자·시각마다 고유 문서로 저장 (세션당 1개가 아니라 환자별 다건)
    const surveyDocId = `${sessionDocId}_${currentPatientId ?? 'none'}_${Date.now().toString(36)}`;
    try {
      await saveDoc('surveyResponses', surveyDocId, response as unknown as Record<string, unknown>);
    } catch (e) {
      console.warn('[survey] save failed', e);
    }

    // 타겟처 배포: 서베이 완료 = 해당 지정처 '진행 완료'로 기록 (1지정처 1완료, upsert)
    void recordTargetCompletionOnSurvey(get());

    if (surveyOnly) {
      set({ phase: 'select', surveyOnly: false, surveyOnlyDone: true, currentPatientId: null });
    } else {
      set({ phase: 'rx', rxPhase: 'menu' });
    }
  },

  // '서베이만 진행': 환자 없이 공통 질문만 진행하는 서베이 화면으로 이동
  startSurveyOnly: () => {
    set({
      surveyOnly: true,
      surveyOnlyDone: false,
      currentPatientId: null,
      phase: 'survey',
      rxPhase: 'menu',
      lastResult: null,
    });
  },

  dismissSurveyOnlyDone: () => set({ surveyOnlyDone: false }),

  selectPatient: (id) => {
    // 재진/리핏: 환자가 현재 복용 중인 약(prevDrugs)을 처방 슬롯에 미리 채워준다.
    const patient = useDataStore.getState().patients.find((p) => p.id === id);
    // 이 환자의 공병증에 해당하는 서베이 질문이 있으면 시뮬레이션 전에 먼저 진행한다.
    const applicable = surveyQuestionsForPatient(
      useDataStore.getState().surveyQuestions,
      patient?.comorbidities ?? [],
    );
    const hasSurvey = applicable.length > 0;
    set({
      currentPatientId: id,
      slots: slotsFromPrevDrugs(patient?.prevDrugs),
      slotBids: emptyBids(),
      diagCodes: [],
      rxPhase: 'menu',
      phase: hasSurvey ? 'survey' : 'rx',
      lastResult: null,
      surveyOnly: false,
      surveyOnlyDone: false,
    });
  },

  logGiftSpin: (gift) => {
    const {
      sessionDocId,
      sessionKey,
      hospitalName,
      doctorName,
      department,
      institutionType,
      currentPatientId,
      loginFieldValues,
    } = get();
    const patient = useDataStore.getState().patients.find((p) => p.id === currentPatientId);
    const log: GiftLog = {
      id: `${sessionDocId}_${currentPatientId ?? 'none'}_${Date.now().toString(36)}`,
      sessionDocId,
      sessionKey,
      hospitalName,
      doctorName,
      department,
      institutionType,
      patientId: currentPatientId ?? '',
      patientName: patient?.name ?? '',
      giftId: gift?.id ?? '',
      giftName: gift?.name ?? '꽝',
      isWin: gift != null,
      spunAt: new Date().toISOString(),
      loginFieldValues,
    };
    void saveGiftLog(log).catch((e) => {
      console.warn('[gift] saveGiftLog failed', e);
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
    const bids = [...get().slotBids] as Bids;
    bids[idx] = false;
    set({ slots: next, slotBids: bids });
  },

  toggleSlotBid: (idx) => {
    if (idx < 0 || idx > 4) return;
    const bids = [...get().slotBids] as Bids;
    bids[idx] = !bids[idx];
    set({ slotBids: bids });
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
      slotBids,
      diagCodes,
      sessionPrescriptions,
      hospitalName,
      doctorName,
      department,
      institutionType,
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

    // 기준 처방(현재 복용 중) — 효과 중복 적용 방지용
    const baselineMeds = slotsFromPrevDrugs(patient.prevDrugs).map((id) =>
      id ? data.medications.find((m) => m.id === id) ?? null : null,
    );

    const current = getPatientCurrentState(patient, sessionPrescriptions, data.medications, data.patientMetricDefs);
    const pastSideEffectCounts = countPastSideEffects(
      sessionPrescriptions,
      patient.id,
      data.medications,
    );

    // eGFR 이니셜딥: 딥을 유발하는 계열과, 환자가 이미 노출된 딥 계열을 파악해 전달.
    const dipClassIds = deriveDipClassIds(data.medications);
    const experiencedDipClassIds = deriveExperiencedDipClasses(
      patient.id,
      sessionPrescriptions,
      baselineMeds,
      dipClassIds,
    );

    const result = calculatePrescription({
      patient,
      current,
      slots: slotMeds,
      baselineSlots: baselineMeds,
      bidFlags: slotBids,
      diagCodes,
      settings: data.settings,
      exemptions: data.sideEffectExemptions,
      pastSideEffectCounts,
      patientMetricDefs: data.patientMetricDefs,
      dipClassIds,
      experiencedDipClassIds,
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

    // 이 처방 직전 환자가 실제로 복용 중이던 보험 약제의 계열 수.
    // 같은 시연 세션에 직전 처방이 있으면 그 보험 슬롯 약제를, 없으면 prevDrugs를 기준으로 한다.
    // 유지/감량 처방을 신규 병용으로 오인해 삭감하지 않도록 쓰인다.
    const priorRx = [...sessionPrescriptions].reverse().find((p) => p.patientId === patient.id);
    const priorMeds: Medication[] = priorRx
      ? priorRx.prescribedDrugs
          .filter((d) => !d.isSelfPay && d.slot < 4)
          .map((d) => data.medications.find((m) => m.id === d.id))
          .filter((m): m is Medication => m != null)
      : baselineMeds.filter((m): m is Medication => m != null);
    const priorClassCount = countInsuranceClasses(priorMeds);

    const deductionReasons = checkDeductions(
      insuranceSlotMeds,
      diagCodes,
      current.hba1c,
      data.deductionRules,
      data.allowedCombinations,
      data.settings,
      priorClassCount,
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
        department,
        institutionType,
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
      slotBids: emptyBids(),
      diagCodes: [],
      lastResult: null,
      surveyOnly: false,
    });
  },

  resetToLogin: () => {
    set({
      phase: 'login',
      rxPhase: 'menu',
      hospitalName: '',
      doctorName: '',
      institutionType: '병원',
      department: '',
      sessionKey: '',
      sessionDocId: '',
      sessionCreatedAt: '',
      loginFieldValues: {},
      targetId: '',
      targetCode: '',
      campaignId: '',
      empNo: '',
      empName: '',
      division: '',
      team: '',
      currentPatientId: null,
      slots: emptySlots(),
      slotBids: emptyBids(),
      diagCodes: [],
      comorbFilter: '전체',
      sessionPrescriptions: [],
      lastResult: null,
      surveyOnly: false,
      surveyOnlyDone: false,
    });
  },

  goAdmin: () => set({ phase: 'admin' }),
  exitAdmin: () => set({ phase: 'login' }),
  goMyResults: () => set({ phase: 'myresults' }),
}));

/**
 * 서베이 완료 시 타겟처(지정처) '진행 완료'를 기록한다. 타겟처 세션(targetId 존재)에서만 동작.
 * 1지정처 1완료(문서 id = campaignId__targetId)라 여러 번 완료해도 덮어쓴다(upsert).
 */
function recordTargetCompletionOnSurvey(s: SessionState): void {
  if (!s.targetId || !s.campaignId) return;
  const completion: TargetCompletion = {
    id: `${s.campaignId}__${s.targetId}`,
    campaignId: s.campaignId,
    targetId: s.targetId,
    code: s.targetCode,
    name: s.hospitalName,
    institutionType: s.institutionType,
    empNo: s.empNo,
    empName: s.empName,
    division: s.division,
    team: s.team,
    doctorName: s.doctorName,
    completedAt: new Date().toISOString(),
  };
  void saveTargetCompletion(completion).catch((e) => {
    console.warn('[target] saveTargetCompletion failed', e);
  });
}

/**
 * eGFR 이니셜딥을 유발하는 계열 id 목록. 단일계열(mono) 약제 중 effectEgfrDip≠0 인
 * 약제의 계열을 딥 계열로 간주한다(예: SGLT-2i, GLP-1 RA). 복합제의 딥은 이 계열로 귀속.
 */
function deriveDipClassIds(meds: Medication[]): string[] {
  const s = new Set<string>();
  for (const m of meds) {
    if (m.classes.length === 1 && m.effectEgfrDip) s.add(m.classes[0]);
  }
  return [...s];
}

/**
 * 환자가 이미 노출된 딥 계열. 이전 복용약(prevDrugs)과 같은 시연 세션의 이전 처방에서
 * 딥 계열을 모은다. 여기 포함된 계열은 이번 처방에서 이니셜딥을 다시 적용하지 않는다.
 */
function deriveExperiencedDipClasses(
  patientId: string,
  sessionPrescriptions: Prescription[],
  baselineMeds: (Medication | null)[],
  dipClassIds: string[],
): string[] {
  const dip = new Set(dipClassIds);
  const out = new Set<string>();
  for (const m of baselineMeds) {
    if (!m) continue;
    for (const c of m.classes) if (dip.has(c)) out.add(c);
  }
  for (const p of sessionPrescriptions) {
    if (p.patientId !== patientId) continue;
    for (const d of p.prescribedDrugs) {
      for (const c of d.classes) if (dip.has(c)) out.add(c);
    }
  }
  return [...out];
}

/** 보험 삭감 검사 대상(isInsuranceException·isNotDrug 제외) 약제의 서로 다른 계열 수 */
function countInsuranceClasses(meds: Medication[]): number {
  const classes = new Set<string>();
  for (const m of meds) {
    if (m.isInsuranceException || m.isNotDrug) continue;
    for (const c of m.classes) classes.add(c);
  }
  return classes.size;
}

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
