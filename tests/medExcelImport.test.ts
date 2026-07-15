import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseMedicationsXlsx } from '../src/lib/medExcelImport';
import { seedMedications } from '../src/data/seed';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = join(ROOT, '기본 약제 초기화.xlsx');

// 브라우저 "엑셀 반영" 파서(medExcelImport.ts)와 시드 생성기(genMedications.mjs)는
// 반드시 같은 결과를 내야 한다. 커밋된 xlsx 를 파싱한 결과가 커밋된 seedMedications 와
// 완전히 일치하는지 비교해 두 구현의 드리프트를 잡는다.
describe('medExcelImport ↔ seedMedications 동기화', () => {
  it("'기본 약제 초기화.xlsx' 파싱 결과가 seedMedications 와 완전히 동일", async () => {
    const bytes = new Uint8Array(readFileSync(XLSX));
    const parsed = await parseMedicationsXlsx(bytes);
    expect(parsed).toEqual(seedMedications);
  });

  it('판매사 종근당 제품은 모두 isAsaProduct=true', async () => {
    const parsed = await parseMedicationsXlsx(new Uint8Array(readFileSync(XLSX)));
    const asa = parsed.filter((m) => m.isAsaProduct);
    expect(asa.length).toBeGreaterThan(0);
    // 종근당 제품(자누비아/자누메트/엠파맥스/엠시폴민/듀비에/네오마릴 계열)만 아사
    for (const m of asa) expect(m.isNotDrug).toBe(false);
  });

  it('계열 수로 구분 파생 (단일제·2제·메폴민2제·3제)', async () => {
    const parsed = await parseMedicationsXlsx(new Uint8Array(readFileSync(XLSX)));
    for (const m of parsed) {
      if (m.pkg === 'injection' || m.isNotDrug) continue;
      const n = m.classes.length;
      const hasMet = m.classes.includes('dc_met');
      const expected =
        n >= 3 ? 'cat_combo3' : n === 2 ? (hasMet ? 'cat_combo_met' : 'cat_combo2') : 'cat_single';
      expect(m.categoryId, `${m.id} ${m.name}`).toBe(expected);
    }
  });
});
