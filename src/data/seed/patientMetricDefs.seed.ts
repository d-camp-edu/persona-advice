import type { PatientMetricDef } from '../../types';

export const seedPatientMetricDefs: PatientMetricDef[] = [
  { id: 'hba1c',     label: 'HbA1c',      unit: '%',                  direction: 'decrease_good', isBuiltIn: true, enabled: true, order: 1 },
  { id: 'weight',    label: '체중',        unit: 'kg',                 direction: 'decrease_good', isBuiltIn: true, enabled: true, order: 2 },
  { id: 'bmi',       label: 'BMI',         unit: 'kg/m²',              direction: 'decrease_good', isBuiltIn: true, enabled: true, order: 3 },
  { id: 'lvef',      label: 'LVEF',        unit: '%',                  direction: 'increase_good', isBuiltIn: true, enabled: true, order: 4 },
  { id: 'nyha',      label: 'NYHA',        unit: '등급',               direction: 'decrease_good', isBuiltIn: true, enabled: true, order: 5 },
  { id: 'bnp',       label: 'BNP',         unit: 'pg/mL',              direction: 'decrease_good', isBuiltIn: true, enabled: true, order: 6 },
  { id: 'ntprobnp',  label: 'NT-proBNP',   unit: 'pg/mL',              direction: 'decrease_good', isBuiltIn: true, enabled: true, order: 7 },
  { id: 'egfr',      label: 'eGFR',        unit: 'mL/min/1.73m²',      direction: 'increase_good', isBuiltIn: true, enabled: true, order: 8 },
  { id: 'uacr',      label: 'UACR',        unit: 'mg/g',               direction: 'decrease_good', isBuiltIn: true, enabled: true, order: 9 },
];
