import type {
  CurrentState,
  GlobalSettings,
  Medication,
  Patient,
  PatientMetricDef,
  PrescribedDrug,
  Prescription,
  PrescriptionResult,
  SideEffectExemption,
} from '../types';
import { buildComorbFeedback, buildPatientFeedback, type ComorbHit } from './messages';

export interface CalculatePrescriptionInput {
  patient: Patient;
  current: CurrentState;
  slots: (Medication | null)[];
  diagCodes: string[];
  settings: GlobalSettings;
  exemptions: SideEffectExemption[];
  pastSideEffectCounts: Record<string, number>;
  patientMetricDefs?: PatientMetricDef[];
  rng?: () => number;
  now?: () => Date;
}

interface Totals {
  h: number;
  w: number;
  l: number;
  n: number;
  b: number;
  nt: number;
  eg: number;
  ua: number;
}

const POOR_ADHERENCE_PENALTY = -0.4;

export function calculatePrescription(input: CalculatePrescriptionInput): PrescriptionResult {
  const {
    patient,
    current,
    slots,
    diagCodes,
    settings,
    exemptions,
    pastSideEffectCounts,
    patientMetricDefs = [],
    rng = Math.random,
    now = () => new Date(),
  } = input;

  const selected = slots
    .map((m, idx) => (m ? { med: m, slotIndex: idx } : null))
    .filter((s): s is { med: Medication; slotIndex: number } => s !== null);

  const drugSelected = selected.filter((s) => !s.med.isNotDrug);
  const isLifestyleOnly = selected.length > 0 && drugSelected.length === 0;

  const activeClasses = new Set<string>();
  for (const s of selected) for (const c of s.med.classes) activeClasses.add(c);

  const exemptedClassIds = collectExemptedClassIds(exemptions, activeClasses);
  const giSkipDueToHistory = (pastSideEffectCounts['위장장애'] ?? 0) >= 2;

  const totals: Totals = { h: 0, w: 0, l: 0, n: 0, b: 0, nt: 0, eg: 0, ua: 0 };
  const customTotals: Record<string, number> = {};
  const sideEffects: string[] = [];
  const comorbHits: ComorbHit[] = [];

  const customDefs = patientMetricDefs.filter((d) => !d.isBuiltIn && d.enabled);

  for (const { med } of selected) {
    let eH = med.isNotDrug ? 0 : med.effect;

    if (!med.isNotDrug) {
      const causesGi = med.worseningComorb.includes('위장장애');
      const exemptByCombo = med.classes.some((c) => exemptedClassIds.has(c));
      const skipSideEffect = (causesGi && giSkipDueToHistory) || exemptByCombo;

      if (!skipSideEffect && rng() * 100 < med.sideEffectProb) {
        sideEffects.push(`[${med.name}] ${med.sideEffectMsg}`);
        eH = Math.max(0, eH - med.sideEffectPenalty);
      }
    }

    totals.h += eH;
    totals.w += med.effectWeight;
    totals.l += med.effectLvef;
    totals.b += med.effectBnp;
    totals.nt += med.effectNtprobnp;
    totals.eg += med.effectEgfr;
    totals.ua += med.effectUacr;

    for (const def of customDefs) {
      customTotals[def.id] = (customTotals[def.id] ?? 0) + ((med.customEffects ?? {})[def.id] ?? 0);
    }

    for (const name of med.beneficialComorb) {
      if (patient.comorbidities.includes(name)) comorbHits.push({ name, kind: 'good' });
    }
    for (const name of med.worseningComorb) {
      if (patient.comorbidities.includes(name)) comorbHits.push({ name, kind: 'bad' });
    }
  }

  const isPackagingBonus =
    drugSelected.length > 0 && drugSelected.every((s) => s.med.pkg === 'bottle');
  if (isPackagingBonus) {
    totals.h += settings.packagingBonusEffect;
  }

  const isPoorAdherence =
    patient.adherence === '나쁨' && !isPackagingBonus && drugSelected.length > 0;
  if (isPoorAdherence) {
    totals.h = POOR_ADHERENCE_PENALTY;
  }

  const newHba1c = round1(Math.max(4.5, current.hba1c - totals.h));
  const newWeight = round1(current.weight + totals.w);
  const newLvef = optionalNumeric(current.lvef, totals.l);
  const newNyha = optionalNumeric(current.nyha, totals.n);
  const newBnp = optionalNumeric(current.bnp, totals.b);
  const newNtprobnp = optionalNumeric(current.ntprobnp, totals.nt);
  const newEgfr = optionalNumeric(current.egfr, totals.eg);
  const newUacr = optionalNumeric(current.uacr, totals.ua);

  const oldCustomMetrics: Record<string, number | ''> = {};
  const newCustomMetrics: Record<string, number | ''> = {};
  const nextCustomMetrics: Record<string, number> = {};
  for (const def of customDefs) {
    const cur = current.customMetrics?.[def.id] ?? 0;
    const delta = customTotals[def.id] ?? 0;
    const next = cur !== 0 ? round1(cur + delta) : cur;
    oldCustomMetrics[def.id] = cur !== 0 ? cur : '';
    newCustomMetrics[def.id] = cur !== 0 ? next : '';
    nextCustomMetrics[def.id] = next;
  }

  const hasSideEffect = sideEffects.length > 0;
  const patientFeedback = buildPatientFeedback(
    { isLifestyleOnly, hasSideEffect, isPackagingBonus, isPoorAdherence },
    settings,
  );
  const comorbFeedback = buildComorbFeedback(comorbHits, settings.comorbidities, {
    suppress: hasSideEffect,
  });

  const prescribedDrugs: PrescribedDrug[] = selected.map(({ med, slotIndex }) => ({
    slot: slotIndex + 1,
    id: med.id,
    name: med.name,
    classes: [...med.classes],
    isSelfPay: slotIndex >= 3,
  }));

  const ts = now();
  const timestamp = ts.toISOString();

  const prescription: Prescription = {
    id: String(ts.getTime()),
    patientId: patient.id,
    patientName: patient.name,
    prescribedDrugs,
    insuranceCodes: [...diagCodes],
    oldHba1c: current.hba1c,
    newHba1c,
    oldWeight: current.weight,
    newWeight,
    oldLvef: current.lvef ? current.lvef : '',
    newLvef,
    oldNyha: current.nyha ? current.nyha : '',
    newNyha,
    oldBnp: current.bnp ? current.bnp : '',
    newBnp,
    oldNtprobnp: current.ntprobnp ? current.ntprobnp : '',
    newNtprobnp,
    oldEgfr: current.egfr ? current.egfr : '',
    newEgfr,
    oldUacr: current.uacr ? current.uacr : '',
    newUacr,
    sideEffects,
    deductionReasons: [],
    patientFeedback,
    comorbFeedback,
    isPackagingBonus,
    isPoorAdherence,
    timestamp,
    oldCustomMetrics,
    newCustomMetrics,
  };

  return {
    prescription,
    current: {
      hba1c: newHba1c,
      weight: newWeight,
      lvef: typeof newLvef === 'number' ? newLvef : 0,
      nyha: typeof newNyha === 'number' ? newNyha : 0,
      bnp: typeof newBnp === 'number' ? newBnp : 0,
      ntprobnp: typeof newNtprobnp === 'number' ? newNtprobnp : 0,
      egfr: typeof newEgfr === 'number' ? newEgfr : 0,
      uacr: typeof newUacr === 'number' ? newUacr : 0,
      customMetrics: nextCustomMetrics,
    },
  };
}

function collectExemptedClassIds(
  exemptions: SideEffectExemption[],
  activeClasses: Set<string>,
): Set<string> {
  const out = new Set<string>();
  for (const ex of exemptions) {
    if (ex.classIds.length === 0) continue;
    if (ex.classIds.every((c) => activeClasses.has(c))) {
      for (const c of ex.classIds) out.add(c);
    }
  }
  return out;
}

function optionalNumeric(currentValue: number, delta: number): number | '' {
  if (!currentValue) return '';
  return round1(currentValue + delta);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
