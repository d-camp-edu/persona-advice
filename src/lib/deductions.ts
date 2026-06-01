import type {
  AllowedCombination,
  DeductionRule,
  GlobalSettings,
  Medication,
} from '../types';

interface ComboRule {
  classIds: string[];
  message: string;
}

const BUILT_IN_COMBO_RULES: ComboRule[] = [
  {
    classIds: ['dc_dpp4', 'dc_glp1'],
    message: 'DPP-4i와 GLP-1 RA 병용 삭감!',
  },
];

/**
 * 보험 삭감 사유 검사 (기획.md §6).
 * - 슬롯 1~3 중 isInsuranceException=false, isNotDrug=false 약제만 검사 대상.
 * - 병용 금지 조합: 내장(DPP-4i + GLP-1 RA) + admin이 정의한 추가 규칙.
 *   `allowed`에 동일 클래스 집합이 등록돼 있으면 해당 규칙은 면제.
 * - E11 상병이 들어있으면 4가지 sub-rule 추가 검사.
 *
 * `priorClassCount`는 이 처방 직전 환자가 이미 복용 중이던 보험 약제의 계열 수다.
 * - 0보다 크면 "이미 처방받던 환자"로 보고 2제 병용 기준을 초진 기준(dualTherapyThreshold)이
 *   아닌 추가 병용 기준(addOnTherapyThreshold)으로 적용한다.
 * - HbA1c 기반 신규 처방 기준(6.5% 미만 / 2제 병용 기준)은 계열 수가 직전보다 늘어나는
 *   "신규·증량" 처방에만 적용한다. 기존 병용을 그대로 유지(계열 수 동일/감소)하는데
 *   치료가 잘 돼 HbA1c가 목표로 내려온 경우는 삭감 사유가 아니다.
 */
export function checkDeductions(
  slots: Medication[],
  diagCodes: string[],
  currentHba1c: number,
  rules: DeductionRule[],
  allowed: AllowedCombination[],
  settings: GlobalSettings,
  priorClassCount = 0,
): string[] {
  const eligible = slots.filter((m) => !m.isInsuranceException && !m.isNotDrug);
  if (eligible.length === 0) return [];

  const distinctClasses = new Set<string>();
  for (const m of eligible) for (const c of m.classes) distinctClasses.add(c);

  const reasons: string[] = [];

  // 병용 금지 조합 검사
  const adminCombos: ComboRule[] = rules
    .filter((r) => r.enabled !== false && r.classIds.length > 0)
    .map((r) => ({ classIds: r.classIds, message: r.message }));
  const allCombos = [...BUILT_IN_COMBO_RULES, ...adminCombos];

  for (const rule of allCombos) {
    const hits = rule.classIds.every((c) => distinctClasses.has(c));
    if (!hits) continue;
    if (isExempted(rule.classIds, distinctClasses, allowed)) continue;
    reasons.push(rule.message);
  }

  // E11 상병: 당뇨 처방 4규칙
  if (diagCodes.includes('E11')) {
    const includesMet = distinctClasses.has('dc_met');
    const classCount = distinctClasses.size;

    // 이미 급여 대상 당뇨약을 복용 중이면 추가 병용 기준을, 아니면 초진 2제 기준을 적용.
    const onTherapy = priorClassCount > 0;
    const dualThreshold = onTherapy
      ? settings.addOnTherapyThreshold ?? settings.dualTherapyThreshold
      : settings.dualTherapyThreshold;
    // 직전보다 계열 수가 늘어나는 신규·증량 처방인지. 유지/감량이면 HbA1c 기준 삭감 미적용.
    const escalating = classCount > priorClassCount;

    if (escalating && currentHba1c < 6.5) {
      reasons.push('당뇨(E11) 초기 HbA1c 6.5% 미만 처방 삭감!');
    } else if (classCount === 1 && !includesMet) {
      reasons.push('1차 메트포르민 미사용 삭감!');
    } else if (escalating && classCount >= 2 && currentHba1c < dualThreshold) {
      reasons.push(
        onTherapy
          ? '추가 병용 기준 미달 삭감!'
          : '초기 급여 2제 병용 기준 미달 삭감!',
      );
    } else if (classCount >= 2 && currentHba1c >= dualThreshold && !includesMet) {
      reasons.push('병용 요법 1차약제 미포함 삭감!');
    }
  }

  return reasons;
}

/**
 * 병용 금지 규칙(ruleClassIds)이 허용 조합으로 면제되는지 검사.
 *
 * 면제 조건: 등록된 허용 조합 A 중 하나라도
 *   ① 금지 규칙이 A 안에 들어 있고(ruleClassIds ⊆ A),
 *   ② A의 모든 약제 계열이 실제 처방에 전부 포함되어 있을 때(A ⊆ prescribedClasses).
 *
 * 예) 허용 조합 [메트, SGLT-2i, DPP-4i]를 등록하고 그 3종을 함께 처방하면,
 *     [SGLT-2i, DPP-4i] 같은 부분 집합 금지 규칙도 면제된다.
 *     (반대로 허용 조합에 없는 다른 계열까지 처방하면 면제되지 않는다.)
 */
function isExempted(
  ruleClassIds: string[],
  prescribedClasses: Set<string>,
  allowed: AllowedCombination[],
): boolean {
  return allowed.some((a) => {
    const allowedSet = new Set(a.classIds);
    const ruleWithinAllowed = ruleClassIds.every((c) => allowedSet.has(c));
    if (!ruleWithinAllowed) return false;
    return a.classIds.every((c) => prescribedClasses.has(c));
  });
}
