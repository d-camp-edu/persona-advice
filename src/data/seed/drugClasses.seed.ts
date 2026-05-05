import type { DrugClass } from '../../types';

export const seedDrugClasses: DrugClass[] = [
  { id: 'dc_met', name: 'Biguanide', duplicatable: false },
  { id: 'dc_sglt2', name: 'SGLT-2i', duplicatable: false },
  { id: 'dc_dpp4', name: 'DPP-4i', duplicatable: false },
  { id: 'dc_tzd', name: 'TZD', duplicatable: false },
  { id: 'dc_glp1', name: 'GLP-1 RA', duplicatable: false },
  { id: 'dc_ins_basal', name: 'Insulin (Basal)', duplicatable: false },
  { id: 'dc_ins_premix', name: 'Insulin (Premixed)', duplicatable: false },
  { id: 'dc_ins_mdi', name: 'Insulin (MDI)', duplicatable: false },
];
