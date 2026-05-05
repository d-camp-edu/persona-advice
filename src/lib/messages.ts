import type { ComorbFeedbackEntry, Comorbidity, GlobalSettings } from '../types';

export interface PatientFeedbackInput {
  isLifestyleOnly: boolean;
  hasSideEffect: boolean;
  isPackagingBonus: boolean;
  isPoorAdherence: boolean;
}

const POOR_ADHERENCE_MSG =
  '환자가 약을 제대로 먹지 않았습니다... 혈당이 오히려 상승했어요!';

export function buildPatientFeedback(
  flags: PatientFeedbackInput,
  settings: GlobalSettings,
): string {
  if (flags.isPoorAdherence) return POOR_ADHERENCE_MSG;
  if (flags.isLifestyleOnly) return settings.msgLifestyle;
  if (flags.hasSideEffect) return settings.msgSideEffect;
  if (flags.isPackagingBonus) return settings.msgPackaging;
  return settings.msgSuccess;
}

export interface ComorbHit {
  name: string;
  kind: 'good' | 'bad';
}

/**
 * 약제 효과로 인한 환자 공병증 반응을 설정의 호전/악화 메시지로 변환한다.
 * 한 공병증에 호전·악화 둘 다 잡히면 악화('bad')가 우선한다.
 * 부작용이 발생한 처방에서는 공병증 메시지를 표시하지 않는다(§5-4).
 */
export function buildComorbFeedback(
  hits: ComorbHit[],
  comorbidities: Comorbidity[],
  options: { suppress: boolean },
): Record<string, ComorbFeedbackEntry> {
  if (options.suppress) return {};

  const byName = new Map<string, 'good' | 'bad'>();
  for (const h of hits) {
    const prev = byName.get(h.name);
    if (prev === 'bad') continue;
    if (h.kind === 'bad') {
      byName.set(h.name, 'bad');
    } else if (!prev) {
      byName.set(h.name, 'good');
    }
  }

  const out: Record<string, ComorbFeedbackEntry> = {};
  for (const [name, kind] of byName) {
    const def = comorbidities.find((c) => c.name === name);
    if (!def) continue;
    out[name] = {
      type: kind,
      msg: kind === 'good' ? def.goodMsg : def.badMsg,
    };
  }
  return out;
}
