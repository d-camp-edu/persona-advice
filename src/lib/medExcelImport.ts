// 브라우저에서 '기본 약제 초기화.xlsx'(사용자가 수정한 파일)를 읽어 Medication[] 로 변환한다.
// 관리자 콘솔 "엑셀 반영" 버튼이 사용한다 — 파일 선택 → 파싱 → Firestore 업로드.
//
// ⚠️ 매핑 로직은 scripts/genMedications.mjs 와 반드시 동일해야 한다. 한쪽을 바꾸면
//    다른 쪽도 바꿔라. tests/medExcelImport.test.ts 가 이 함수의 결과를 커밋된
//    seedMedications 와 deep-equal 비교해 드리프트를 잡는다.
//
// 의존성 없이 동작: zip 인플레이트는 브라우저 내장 DecompressionStream('deflate-raw'),
// 시트 XML 파싱은 정규식. inlineStr(<is><t>)·공유문자열(sharedStrings, Excel 재저장 시) 모두 지원.

import type { Medication } from '../types';

// ── 지표 변환 상수 (genMedications.mjs 와 동일) ─────────────────────────
const LVEF_REF = 40;
const BNP_REF = 60;
const NTPROBNP_REF = 200;
const UACR_REF = 150;

// 엑셀 계열 열(33~41) → 내부 dc_* id
const CLASS_COLS: Record<string, number> = {
  dc_dpp4: 33,
  dc_glp1: 34,
  dc_ins_basal: 35,
  dc_ins_mdi: 36,
  dc_ins_premix: 37,
  dc_met: 38,
  dc_sglt2: 39,
  dc_tzd: 40,
  dc_su: 41,
};

const COMORB_BY_CLASS: Record<string, { good: string[]; bad: string[] }> = {
  dc_met: { good: ['비만', 'MASH'], bad: ['위장장애'] },
  dc_dpp4: { good: [], bad: [] },
  dc_sglt2: { good: ['심부전', '만성신장질환(CKD)', '심혈관'], bad: ['생식기감염'] },
  dc_tzd: { good: ['MASH'], bad: ['심부전', '비만'] },
  dc_glp1: { good: ['비만', '심혈관'], bad: ['위장장애'] },
  dc_su: { good: [], bad: ['저혈당', '비만'] },
  dc_ins_basal: { good: ['전반적 개선'], bad: ['비만', '저혈당'] },
  dc_ins_mdi: { good: ['전반적 개선'], bad: ['비만', '저혈당'] },
  dc_ins_premix: { good: ['전반적 개선'], bad: ['비만', '저혈당'] },
};

const HBA1C_FALLBACK: Record<string, number> = {
  dc_glp1: 0.3,
  dc_ins_basal: 1.5,
  dc_ins_mdi: 1.5,
  dc_ins_premix: 2.0,
};

// ── zip 리더 (브라우저) ─────────────────────────────────────────────────
function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

/** 중앙 디렉터리를 파싱해 원하는 엔트리(이름 → 압축해제 바이트)만 추출한다. */
async function readZipEntries(buf: Uint8Array, want: (name: string) => boolean): Promise<Record<string, Uint8Array>> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('올바른 xlsx(zip) 파일이 아닙니다.');
  const count = u16(buf, eocd + 10);
  let cd = u32(buf, eocd + 16);
  const dec = new TextDecoder('utf-8');
  const out: Record<string, Uint8Array> = {};
  for (let n = 0; n < count; n++) {
    if (u32(buf, cd) !== 0x02014b50) throw new Error('zip 중앙 디렉터리 헤더 손상');
    const method = u16(buf, cd + 10);
    const compSize = u32(buf, cd + 20);
    const nameLen = u16(buf, cd + 28);
    const extraLen = u16(buf, cd + 30);
    const commentLen = u16(buf, cd + 32);
    const localOff = u32(buf, cd + 42);
    const name = dec.decode(buf.subarray(cd + 46, cd + 46 + nameLen));
    if (want(name)) {
      const lhNameLen = u16(buf, localOff + 26);
      const lhExtraLen = u16(buf, localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const comp = buf.subarray(dataStart, dataStart + compSize);
      out[name] = method === 0 ? comp.slice() : await inflateRaw(comp);
    }
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ── XML 파싱 ────────────────────────────────────────────────────────────
function decodeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colToIdx(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** sharedStrings.xml → 문자열 배열. rich text(<r><t>) 는 런의 <t> 를 이어 붙인다. */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const body = m[1] ?? '';
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    let s = '';
    while ((t = tRe.exec(body))) s += decodeXml(t[1]);
    out.push(s);
  }
  return out;
}

/** sheet xml → 행 배열(각 행은 셀 문자열 배열). inlineStr·sharedStrings·숫자 모두 처리. */
function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(xml))) {
    const rIdx = +m[1];
    const cellsXml = m[2];
    const cells: Record<number, string> = {};
    const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let c: RegExpExecArray | null;
    while ((c = cRe.exec(cellsXml))) {
      const attrs = c[1] ?? c[3] ?? '';
      const refM = attrs.match(/r="([A-Z]+)\d+"/);
      if (!refM) continue;
      const col = colToIdx(refM[1]);
      if (c[3] !== undefined) {
        cells[col] = ''; // 자기닫힘(빈 셀)
        continue;
      }
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? '';
      const inner = c[2];
      const isM = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (type === 'inlineStr' || isM) {
        cells[col] = isM ? decodeXml(isM[1]) : '';
      } else if (vM) {
        const raw = decodeXml(vM[1]);
        cells[col] = type === 's' ? shared[+raw] ?? '' : raw;
      } else {
        cells[col] = '';
      }
    }
    let maxCol = -1;
    for (const k of Object.keys(cells)) if (+k > maxCol) maxCol = +k;
    const arr: string[] = [];
    for (let i = 0; i <= maxCol; i++) arr.push(cells[i] ?? '');
    rows[rIdx] = arr;
  }
  return rows;
}

// ── 값 파서 (genMedications.mjs 와 동일) ────────────────────────────────
function parseNum(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/[%＋]/g, '').replace(/,/g, '');
  if (s === '' || /N\/A|개별화|해당없음/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
const parsePct = parseNum;
const round1 = (n: number) => Math.round(n * 10) / 10;

// ── 계열/카테고리/포장 매핑 (genMedications.mjs 와 동일) ────────────────
function classesFromRow(cells: string[]): string[] {
  const out: string[] = [];
  for (const [dc, col] of Object.entries(CLASS_COLS)) {
    if (String(cells[col] ?? '').trim() === '1') out.push(dc);
  }
  return out;
}

function pkgFromRow(pack: unknown): Medication['pkg'] {
  const p = String(pack ?? '');
  if (/펜|바이알|프리필드/.test(p)) return 'injection';
  if (/병포장/.test(p)) return 'bottle';
  return 'ptp';
}

function categoryFromRow(pkg: Medication['pkg'], classes: string[]): string {
  if (pkg === 'injection') return 'cat_injection';
  const n = classes.length;
  if (n >= 3) return 'cat_combo3';
  if (n === 2) return classes.includes('dc_met') ? 'cat_combo_met' : 'cat_combo2';
  return 'cat_single';
}

function egfrLimitFromClasses(classes: string[]): number {
  if (classes.includes('dc_sglt2')) return 25;
  if (classes.includes('dc_met')) return 30;
  return 0;
}

function comorbFromClasses(classes: string[]): { good: string[]; bad: string[] } {
  const good = new Set<string>();
  const bad = new Set<string>();
  for (const c of classes) {
    const t = COMORB_BY_CLASS[c];
    if (!t) continue;
    t.good.forEach((x) => good.add(x));
    t.bad.forEach((x) => bad.add(x));
  }
  for (const x of bad) good.delete(x);
  return { good: [...good], bad: [...bad] };
}

function buildMed(cells: string[], order: number): Medication {
  const classes = classesFromRow(cells);
  const pkg = pkgFromRow(cells[25]);
  const name = `${String(cells[3] ?? '').trim()} ${String(cells[5] ?? '').trim()}`.trim();

  const hb = parseNum(cells[7]);
  let effect: number;
  if (hb !== null) effect = round1(-hb);
  else {
    const primary = classes.find((c) => HBA1C_FALLBACK[c] !== undefined);
    effect = primary ? HBA1C_FALLBACK[primary] : 0;
  }

  const pct = (col: number, ref: number) => round1(((parsePct(cells[col]) ?? 0) / 100) * ref);
  const { good, bad } = comorbFromClasses(classes);

  return {
    id: `m_${order}`,
    name,
    ingredient: String(cells[4] ?? '').trim(), // 주성분 (복합제는 '/' 구분)
    categoryId: categoryFromRow(pkg, classes),
    pkg,
    classes,
    isNotDrug: false,
    effect,
    effectWeight: parseNum(cells[8]) ?? 0,
    effectLvef: pct(10, LVEF_REF),
    effectBnp: pct(12, BNP_REF),
    effectNtprobnp: pct(13, NTPROBNP_REF),
    effectEgfr: parseNum(cells[15]) ?? 0,
    effectEgfrDip: parseNum(cells[14]) ?? 0,
    effectUacr: pct(16, UACR_REF),
    beneficialComorb: good,
    worseningComorb: bad,
    sideEffectProb: Math.round((parseNum(cells[30]) ?? 0) * 100),
    sideEffectPenalty: parseNum(cells[31]) ?? 0,
    sideEffectMsg: String(cells[32] ?? '').trim(),
    egfrLimit: egfrLimitFromClasses(classes),
    allowHFrEFCoverage: String(cells[26] ?? '').trim() === '1',
    allowHFpEFCoverage: String(cells[27] ?? '').trim() === '1',
    allowCkdCoverage: String(cells[28] ?? '').trim() === '1',
    isInsuranceException: false,
    allow2TQD: String(cells[29] ?? '').trim() === '1',
    isAsaProduct: String(cells[0] ?? '').trim() === '종근당',
    order,
  };
}

function lifestyleMed(order: number): Medication {
  return {
    id: 'm_lifestyle',
    name: '생활습관 교정 (운동/식단)',
    ingredient: '',
    categoryId: 'cat_lifestyle',
    pkg: 'ptp',
    classes: [],
    isNotDrug: true,
    effect: 0.3,
    effectWeight: -1,
    effectLvef: 0,
    effectBnp: 0,
    effectNtprobnp: 0,
    effectEgfr: 0,
    effectEgfrDip: 0,
    effectUacr: 0,
    beneficialComorb: ['전반적 개선', '비만'],
    worseningComorb: [],
    sideEffectProb: 0,
    sideEffectPenalty: 0,
    sideEffectMsg: '',
    egfrLimit: 0,
    allowHFrEFCoverage: false,
    allowHFpEFCoverage: false,
    allowCkdCoverage: false,
    isInsuranceException: true,
    allow2TQD: false,
    isAsaProduct: false,
    order,
  };
}

/**
 * xlsx 파일(File/Blob/ArrayBuffer/Uint8Array) → Medication[].
 * genMedications.mjs 의 main() 과 동일한 규칙으로 행을 필터링/변환한다.
 */
export async function parseMedicationsXlsx(input: File | Blob | ArrayBuffer | Uint8Array): Promise<Medication[]> {
  let bytes: Uint8Array;
  if (input instanceof Uint8Array) bytes = input;
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else bytes = new Uint8Array(await input.arrayBuffer());

  const entries = await readZipEntries(
    bytes,
    (name) => name === 'xl/worksheets/sheet1.xml' || name === 'xl/sharedStrings.xml',
  );
  const sheetBytes = entries['xl/worksheets/sheet1.xml'];
  if (!sheetBytes) throw new Error("워크북에 'xl/worksheets/sheet1.xml' 시트가 없습니다.");
  const dec = new TextDecoder('utf-8');
  const shared = entries['xl/sharedStrings.xml']
    ? parseSharedStrings(dec.decode(entries['xl/sharedStrings.xml']))
    : [];
  const rows = parseSheet(dec.decode(sheetBytes), shared);

  const meds: Medication[] = [];
  let order = 0;
  for (let r = 2; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells) continue;
    const series = String(cells[1] ?? '').trim();
    const name = String(cells[3] ?? '').trim();
    if (!series || series.startsWith('※') || !name) continue;
    order += 1;
    meds.push(buildMed(cells, order));
  }
  meds.push(lifestyleMed(order + 1));

  const drugRows = meds.filter((m) => !m.isNotDrug);
  if (drugRows.length === 0) {
    throw new Error('약제 데이터를 한 건도 읽지 못했습니다. 엑셀 형식을 확인하세요.');
  }
  return meds;
}
