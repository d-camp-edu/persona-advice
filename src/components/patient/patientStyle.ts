import type { BadgeColor } from '../common/Badge';
import type { Comorbidity, Patient } from '../../types';

const ALLOWED_BADGE_COLORS: ReadonlySet<BadgeColor> = new Set([
  'gray',
  'blue',
  'yellow',
  'green',
  'red',
  'orange',
  'purple',
]);

export function colorForComorb(name: string, comorbidities: Comorbidity[]): BadgeColor {
  const c = comorbidities.find((x) => x.name === name);
  if (!c?.color) return 'gray';
  return ALLOWED_BADGE_COLORS.has(c.color as BadgeColor) ? (c.color as BadgeColor) : 'gray';
}

export function typeBadgeColor(type: Patient['type']): BadgeColor {
  if (type === '초진') return 'blue';
  if (type === '재진') return 'green';
  return 'purple'; // 리핏
}

export function genderLabel(gender: Patient['gender']): string {
  return gender === 'M' ? '남' : '여';
}
