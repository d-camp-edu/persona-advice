// scripts/genMedications.mjs
//
// '기본 약제 초기화.xlsx'(레포 루트)를 읽어 src/data/seed/medications.seed.ts 를 재생성한다.
// 의존성 없이 동작한다(Node 내장 zlib 만 사용). 실행:  node scripts/genMedications.mjs
//
// ┌ 워크플로 ─────────────────────────────────────────────────────────────┐
// │ 사용자가 '기본 약제 초기화.xlsx' 를 수정 → 이 스크립트를 다시 실행 → 커밋   │
// │ 하면 관리자 콘솔 "기본 초기화" 버튼이 업로드하는 기본 약제가 그대로 바뀐다.  │
// └───────────────────────────────────────────────────────────────────────┘
//
// 엑셀 열 → Medication 필드 매핑은 아래 buildMed() 참고. 엑셀에 없는 값
// (공병증 호전/악화, eGFR 하한)은 계열(class) 기준 표에서 파생한다.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_PATH = join(ROOT, '기본 약제 초기화.xlsx');
const OUT_PATH = join(ROOT, 'src/data/seed/medications.seed.ts');

// ── 지표 변환 상수 ──────────────────────────────────────────────────────
// 엑셀에서 LVEF·BNP·NT-proBNP·UACR 은 "위약대비 %변화" 로 기록돼 있다.
// 앱 엔진은 절대 증감량(포인트/pg/mL·mg/g)을 더하므로, 계열 대표 기준치로
// %를 절대량으로 환산한다. (기준치는 데모 환자군의 전형값)
const LVEF_REF = 40; // %
const BNP_REF = 60; // pg/mL
const NTPROBNP_REF = 200; // pg/mL
const UACR_REF = 150; // mg/g

// ── 계열(class) 파생 표 ────────────────────────────────────────────────
// 엑셀 계열 열(33~41) → 내부 dc_* id
const CLASS_COLS = {
  'dc_dpp4': 33,
  'dc_glp1': 34,
  'dc_ins_basal': 35,
  'dc_ins_mdi': 36,
  'dc_ins_premix': 37,
  'dc_met': 38,
  'dc_sglt2': 39,
  'dc_tzd': 40,
  'dc_su': 41,
};

// 엑셀에 없는 공병증 호전/악화는 계열 기준으로 파생한다.
const COMORB_BY_CLASS = {
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

// 엑셀 HbA1c 가 'N/A'/'개별화' 인 행의 대체 강하폭(계열 기준)
const HBA1C_FALLBACK = {
  dc_glp1: 0.3, // 오젬픽 0.25mg (적정 시작용량)
  dc_ins_basal: 1.5,
  dc_ins_mdi: 1.5,
  dc_ins_premix: 2.0,
};

// ── 최소 XLSX(zip) 리더 ────────────────────────────────────────────────
// 중앙 디렉터리를 파싱해 원하는 엔트리만 추출한다. deflate(방식8)/무압축(방식0) 지원.
function readZipEntries(buf) {
  // End of Central Directory 레코드 탐색 (뒤에서부터)
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('EOCD not found — not a valid zip/xlsx');
  const count = buf.readUInt16LE(eocd + 10);
  let cd = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad central dir header');
    const method = buf.readUInt16LE(cd + 10);
    const compSize = buf.readUInt32LE(cd + 20);
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const localOff = buf.readUInt32LE(cd + 42);
    const name = buf.toString('utf8', cd + 46, cd + 46 + nameLen);
    // 로컬 헤더에서 실제 데이터 오프셋 계산
    const lhNameLen = buf.readUInt16LE(localOff + 26);
    const lhExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    entries[name] = method === 0 ? Buffer.from(comp) : inflateRawSync(comp);
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXml(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colToIdx(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// sheet xml → 행 배열(각 행은 셀 문자열 배열). inlineStr(<is><t>)만 쓰는 시트 가정.
function parseSheet(xml) {
  const rows = [];
  const rowRe = /<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const rIdx = +m[1];
    const cellsXml = m[2];
    const cells = {};
    const cRe = /<c r="([A-Z]+)\d+"(?:[^>]*)>([\s\S]*?)<\/c>|<c r="([A-Z]+)\d+"[^>]*\/>/g;
    let c;
    while ((c = cRe.exec(cellsXml))) {
      if (c[3] !== undefined) continue; // 빈 셀
      const col = colToIdx(c[1]);
      const inner = c[2];
      const isM = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      const vM = inner.match(/<v>([\s\S]*?)<\/v>/);
      cells[col] = isM ? decodeXml(isM[1]) : vM ? decodeXml(vM[1]) : '';
    }
    let maxCol = -1;
    for (const k of Object.keys(cells)) if (+k > maxCol) maxCol = +k;
    const arr = [];
    for (let i = 0; i <= maxCol; i++) arr.push(cells[i] ?? '');
    rows[rIdx] = arr;
  }
  return rows;
}

// ── 값 파서 ─────────────────────────────────────────────────────────────
function parseNum(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/[%＋]/g, '').replace(/,/g, '');
  if (s === '' || /N\/A|개별화|해당없음/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
// "+2%" / "-15%" → 숫자(부호 유지). "0" → 0. 비수치 → null
function parsePct(v) {
  return parseNum(v);
}
const round1 = (n) => Math.round(n * 10) / 10;

// ── 계열/카테고리/포장 매핑 ────────────────────────────────────────────
function classesFromRow(cells) {
  const out = [];
  for (const [dc, col] of Object.entries(CLASS_COLS)) {
    if (String(cells[col] ?? '').trim() === '1') out.push(dc);
  }
  return out;
}

function pkgFromRow(pack) {
  const p = String(pack ?? '');
  if (/펜|바이알|프리필드/.test(p)) return 'injection';
  if (/병포장/.test(p)) return 'bottle';
  return 'ptp';
}

// 카테고리는 엑셀 '카테고리' 열이 아니라 체크된 계열(class) 수로 파생한다.
//   주사제(포장=injection) → cat_injection (계열 수 무관)
//   계열 1개 이하           → cat_single      단일제
//   계열 2개(biguanide 제외) → cat_combo2      2제 복합제
//   계열 2개(biguanide 포함) → cat_combo_met   메폴민 2제 복합제
//   계열 3개 이상            → cat_combo3      3제 복합제
function categoryFromRow(_cells, pkg, classes) {
  if (pkg === 'injection') return 'cat_injection';
  const n = classes.length;
  if (n >= 3) return 'cat_combo3';
  if (n === 2) return classes.includes('dc_met') ? 'cat_combo_met' : 'cat_combo2';
  return 'cat_single';
}

function egfrLimitFromClasses(classes) {
  if (classes.includes('dc_sglt2')) return 25;
  if (classes.includes('dc_met')) return 30;
  return 0;
}

function comorbFromClasses(classes) {
  const good = new Set();
  const bad = new Set();
  for (const c of classes) {
    const t = COMORB_BY_CLASS[c];
    if (!t) continue;
    t.good.forEach((x) => good.add(x));
    t.bad.forEach((x) => bad.add(x));
  }
  // 같은 공병증이 호전·악화에 동시에 걸리면 악화를 우선(예: 메트+TZD의 '비만')
  for (const x of bad) good.delete(x);
  return { good: [...good], bad: [...bad] };
}

// ── 한 행 → Medication ─────────────────────────────────────────────────
function buildMed(cells, order) {
  const classes = classesFromRow(cells);
  const pkg = pkgFromRow(cells[25]);
  const name = `${String(cells[3] ?? '').trim()} ${String(cells[5] ?? '').trim()}`.trim();

  // HbA1c: 엑셀 강하폭(음수) → effect(양수=강하). 비수치면 계열 기준 대체.
  const hb = parseNum(cells[7]);
  let effect;
  if (hb !== null) effect = round1(-hb);
  else {
    const primary = classes.find((c) => HBA1C_FALLBACK[c] !== undefined);
    effect = primary ? HBA1C_FALLBACK[primary] : 0;
  }

  const pct = (col, ref) => round1(((parsePct(cells[col]) ?? 0) / 100) * ref);
  const { good, bad } = comorbFromClasses(classes);

  return {
    id: `m_${order}`,
    name,
    ingredient: String(cells[4] ?? '').trim(), // 주성분 (복합제는 '/' 구분)
    categoryId: categoryFromRow(cells, pkg, classes),
    pkg,
    classes,
    isNotDrug: false,
    effect,
    effectWeight: parseNum(cells[8]) ?? 0, // 체중 kg (절대)
    effectLvef: pct(10, LVEF_REF), // LVEF %→포인트
    effectBnp: pct(12, BNP_REF), // BNP %→pg/mL
    effectNtprobnp: pct(13, NTPROBNP_REF), // NT-proBNP %→pg/mL
    effectEgfr: parseNum(cells[15]) ?? 0, // eGFR 연간(항상 적용, 절대)
    effectEgfrDip: parseNum(cells[14]) ?? 0, // eGFR 이니셜딥(첫 노출 1회, 절대)
    effectUacr: pct(16, UACR_REF), // UACR %→mg/g
    beneficialComorb: good,
    worseningComorb: bad,
    sideEffectProb: Math.round((parseNum(cells[30]) ?? 0) * 100), // 0~1 → 0~100(%)
    sideEffectPenalty: parseNum(cells[31]) ?? 0,
    sideEffectMsg: String(cells[32] ?? '').trim(),
    egfrLimit: egfrLimitFromClasses(classes),
    allowHFrEFCoverage: String(cells[26] ?? '').trim() === '1',
    allowHFpEFCoverage: String(cells[27] ?? '').trim() === '1',
    allowCkdCoverage: String(cells[28] ?? '').trim() === '1',
    isInsuranceException: false,
    allow2TQD: String(cells[29] ?? '').trim() === '1',
    // 판매사(엑셀 0열)가 '종근당'이면 아사(자사) 제품 — 처방 슬롯 최상단 노출
    isAsaProduct: String(cells[0] ?? '').trim() === '종근당',
    order,
  };
}

// 엑셀에 없는 '생활습관 교정'(비약물) — 비약물 전용 처방 데모를 위해 항상 추가한다.
function lifestyleMed(order) {
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

// ── TS 직렬화 ───────────────────────────────────────────────────────────
function j(v) {
  return JSON.stringify(v);
}
function serializeMed(m) {
  return `  {
    id: ${j(m.id)}, name: ${j(m.name)}, ingredient: ${j(m.ingredient ?? '')}, categoryId: ${j(m.categoryId)}, pkg: ${j(m.pkg)},
    classes: ${j(m.classes)}, isNotDrug: ${m.isNotDrug},
    effect: ${m.effect}, effectWeight: ${m.effectWeight}, effectLvef: ${m.effectLvef}, effectBnp: ${m.effectBnp}, effectNtprobnp: ${m.effectNtprobnp}, effectEgfr: ${m.effectEgfr}, effectEgfrDip: ${m.effectEgfrDip}, effectUacr: ${m.effectUacr},
    beneficialComorb: ${j(m.beneficialComorb)}, worseningComorb: ${j(m.worseningComorb)},
    sideEffectProb: ${m.sideEffectProb}, sideEffectPenalty: ${m.sideEffectPenalty}, sideEffectMsg: ${j(m.sideEffectMsg)},
    egfrLimit: ${m.egfrLimit}, allowHFrEFCoverage: ${m.allowHFrEFCoverage}, allowHFpEFCoverage: ${m.allowHFpEFCoverage}, allowCkdCoverage: ${m.allowCkdCoverage},
    isInsuranceException: ${m.isInsuranceException}, allow2TQD: ${m.allow2TQD}, isAsaProduct: ${m.isAsaProduct}, order: ${m.order},
  },`;
}

// ── main ────────────────────────────────────────────────────────────────
function main() {
  const buf = readFileSync(XLSX_PATH);
  const entries = readZipEntries(buf);
  const sheetXml = entries['xl/worksheets/sheet1.xml'];
  if (!sheetXml) throw new Error('xl/worksheets/sheet1.xml not found in workbook');
  const rows = parseSheet(sheetXml.toString('utf8'));

  const meds = [];
  let order = 0;
  // row 1 = 헤더. 데이터는 2행부터. 계열 셀이 비었거나 '※'로 시작하는 주석 행은 건너뛴다.
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

  // 정합성 경고: 계열 미매핑 행
  for (const m of meds) {
    if (!m.isNotDrug && m.classes.length === 0) {
      console.warn(`[warn] 계열 미매핑: ${m.id} ${m.name}`);
    }
  }

  const header = `// AUTO-GENERATED — 직접 수정하지 말 것.
// 출처: '기본 약제 초기화.xlsx'  ·  생성: node scripts/genMedications.mjs
// 엑셀을 수정한 뒤 위 명령을 다시 실행하면 이 파일이 재생성된다.
import type { Medication } from '../../types';

export const seedMedications: Medication[] = [
`;
  const body = meds.map(serializeMed).join('\n');
  writeFileSync(OUT_PATH, header + body + '\n];\n', 'utf8');

  // 요약 출력
  const byCat = {};
  for (const m of meds) byCat[m.categoryId] = (byCat[m.categoryId] ?? 0) + 1;
  console.log(`✓ ${meds.length}종 생성 → src/data/seed/medications.seed.ts`);
  console.log('  카테고리별:', byCat);
}

main();
