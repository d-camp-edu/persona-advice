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
 * **허용 조합(`allowed`)은 삭감 규칙보다 상위다.** 처방된 계열 집합이 허용 조합으로
 * 등록돼 있으면 '계열 조합'을 근거로 하는 삭감(동일 계열 중복 · 급여 N제 초과 ·
 * 병용 금지 · E11의 1차 메트포르민 미사용/병용 요법 1차약제 미포함)은 전부 면제된다.
 * 다만 HbA1c 수치를 근거로 하는 삭감(초기 6.5% 미만 · 2제/추가 병용 기준 미달)은
 * 조합과 무관하므로 면제되지 않는다.
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

  // 계열 등장 횟수. 복합제(한 약제가 여러 계열)는 그 계열들을 각각 1회로 센다.
  // 같은 계열이 둘 이상의 약제에서 나오면 중복 처방.
  const classCounts = new Map<string, number>();
  for (const m of eligible) {
    for (const c of new Set(m.classes)) {
      classCounts.set(c, (classCounts.get(c) ?? 0) + 1);
    }
  }
  const distinctClasses = new Set(classCounts.keys());

  const reasons: string[] = [];

  // ── 허용 조합(예외)은 삭감 규칙보다 상위다 ────────────────────────────
  // 처방된 계열 집합 전체가 허용 조합으로 등록돼 있으면, '계열 조합'을 근거로 하는
  // 삭감은 모두 면제한다(동일 계열 중복 · 급여 N제 초과 · 병용 금지 · E11 조합 규칙).
  // HbA1c 수치를 근거로 하는 삭감은 조합과 무관하므로 그대로 유지한다.
  //
  // 판정은 병용 금지 규칙과 같은 isExempted() 규칙을 쓰되 '규칙 계열' 자리에 처방 계열
  // 전체를 넣는다 → 허용 조합과 처방 계열 집합이 정확히 일치할 때만 면제.
  // (넉넉하게 등록한 조합 하나가 급여 한도까지 통째로 풀어버리는 걸 막는다.)
  const regimenExempt = isExempted([...distinctClasses], distinctClasses, allowed);

  // 동일 계열 중복 처방 (단일제 + 같은 계열 복합제, 복합제 간 계열 겹침 등)
  if (!regimenExempt && [...classCounts.values()].some((n) => n >= 2)) {
    reasons.push('동일 계열 중복 처방 삭감!');
  }

  // 급여 병용 계열 수 초과 (기본 3제 초과 = 4제 이상)
  const maxClasses = settings.maxInsuranceClasses ?? 3;
  if (!regimenExempt && distinctClasses.size > maxClasses) {
    reasons.push(`급여 ${maxClasses}제 초과 병용 삭감!`);
  }

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

    // '1차 메트포르민 미사용'·'병용 요법 1차약제 미포함'은 계열 조합을 근거로 하므로
    // 허용 조합에 걸리면 면제한다. HbA1c 기준 두 규칙은 조합과 무관하니 그대로 둔다.
    // (두 조합 규칙은 classCount 조건이 서로 배타적이라 건너뛰어도 아래 가지가
    //  잘못 열리지 않는다: 2번은 classCount===1, 3·4번은 classCount>=2)
    if (escalating && currentHba1c < 6.5) {
      reasons.push('당뇨(E11) 초기 HbA1c 6.5% 미만 처방 삭감!');
    } else if (classCount === 1 && !includesMet && !regimenExempt) {
      reasons.push('1차 메트포르민 미사용 삭감!');
    } else if (escalating && classCount >= 2 && currentHba1c < dualThreshold) {
      reasons.push(
        onTherapy
          ? '추가 병용 기준 미달 삭감!'
          : '초기 급여 2제 병용 기준 미달 삭감!',
      );
    } else if (classCount >= 2 && currentHba1c >= dualThreshold && !includesMet && !regimenExempt) {
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
