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
 */
export function checkDeductions(
  slots: Medication[],
  diagCodes: string[],
  currentHba1c: number,
  rules: DeductionRule[],
  allowed: AllowedCombination[],
  _settings: GlobalSettings,
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
    if (isExempted(rule.classIds, allowed)) continue;
    reasons.push(rule.message);
  }

  // E11 상병: 당뇨 처방 4규칙
  if (diagCodes.includes('E11')) {
    const includesMet = distinctClasses.has('dc_met');
    const classCount = distinctClasses.size;

    if (currentHba1c < 6.5) {
      reasons.push('당뇨(E11) 초기 HbA1c 6.5% 미만 처방 삭감!');
    } else if (classCount === 1 && !includesMet) {
      reasons.push('1차 메트포르민 미사용 삭감!');
    } else if (classCount >= 2 && currentHba1c < 7.5) {
      reasons.push('초기 급여 2제 병용 기준 미달 삭감!');
    } else if (classCount >= 2 && currentHba1c >= 7.5 && !includesMet) {
      reasons.push('병용 요법 1차약제 미포함 삭감!');
    }
  }

  return reasons;
}

function isExempted(ruleClassIds: string[], allowed: AllowedCombination[]): boolean {
  const sortedRule = [...ruleClassIds].sort();
  return allowed.some((a) => {
    if (a.classIds.length !== sortedRule.length) return false;
    const sorted = [...a.classIds].sort();
    return sorted.every((c, i) => c === sortedRule[i]);
  });
}
