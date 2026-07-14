import type { DrugClass } from '../../types';

export const seedDrugClasses: DrugClass[] = [
  { id: 'dc_met', name: 'Biguanide', duplicatable: false, order: 1 },
  { id: 'dc_sglt2', name: 'SGLT-2i', duplicatable: false, order: 2 },
  { id: 'dc_dpp4', name: 'DPP-4i', duplicatable: false, order: 3 },
  { id: 'dc_tzd', name: 'TZD', duplicatable: false, order: 4 },
  { id: 'dc_su', name: 'SU', duplicatable: false, order: 5 },
  { id: 'dc_glp1', name: 'GLP-1 RA', duplicatable: false, order: 6 },
  { id: 'dc_ins_basal', name: 'Insulin (Basal)', duplicatable: false, order: 7 },
  { id: 'dc_ins_premix', name: 'Insulin (Premixed)', duplicatable: false, order: 8 },
  { id: 'dc_ins_mdi', name: 'Insulin (MDI)', duplicatable: false, order: 9 },
];
