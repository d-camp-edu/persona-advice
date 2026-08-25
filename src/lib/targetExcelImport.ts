// 타겟처(지정처) 엑셀 파싱. 두 가지 포맷을 헤더명으로 자동 감지한다.
//   의원: 거래처코드 · 거래처명 · 사업부명 · 팀명 · 담당자사번 · 담당자명
//   병원: 거래처코드 · 거래처명 · Dr.명 · 사업부명 · 팀명 · 담당자사번
// 컬럼 순서가 달라도 헤더 이름으로 매핑하므로 안전하다.
// 한 병원에 Dr.가 여러 명이면 의사별로 별도 타겟이 된다(id 에 Dr.명 포함).
// 거래처/사업부/팀 칸이 세로 병합된 파일도 위 행 값을 이어받아 2번째 Dr.부터 누락되지 않는다.

import { readXlsxRows } from './xlsxReader';
import type { Target, TargetInstitution } from '../types';

export interface ParsedTargets {
  format: TargetInstitution;
  targets: Target[];
  /** 거래처/사번이 비어 건너뛴 데이터 행 수 (조용한 누락을 화면에 알리기 위함) */
  skippedRows: number;
}

/** Firestore 문서 id 로 안전하게: '/'·공백·특수문자를 '_' 로 치환 */
function sanitizeId(s: string): string {
  return s
    .trim()
    .replace(/[/\\#?%*:|"<>\[\]\s]+/g, '_')
    .replace(/^\.+|\.+$/g, '_')
    .slice(0, 120);
}

/**
 * 타겟처 문서 id 규칙 (캠페인 + 거래처 + Dr.명 + 사번).
 * 관리자 화면에서 수동으로 추가한 타겟처도 이 규칙을 써야, 나중에 같은 거래처가 담긴
 * 엑셀을 다시 올려도 같은 문서로 덮어써지고 중복이 생기지 않는다.
 */
export function makeTargetId(
  campaignId: string,
  code: string,
  name: string,
  drName: string,
  empNo: string,
): string {
  return sanitizeId(`${campaignId}__${code || name}__${drName}__${empNo}`);
}

/** 헤더 정규화: 공백·점 제거 + 소문자 */
function norm(s: string): string {
  return String(s ?? '').replace(/[\s.]+/g, '').toLowerCase();
}

/** headers 중 normalized 형태가 candidates(정규화됨) 하나라도 포함하는 첫 컬럼 인덱스 */
function findCol(headers: string[], candidates: string[]): number {
  const cands = candidates.map(norm);
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (!h) continue;
    if (cands.some((c) => h.includes(c))) return i;
  }
  return -1;
}

/** 헤더처럼 보이는 첫 행(‘거래처’ 포함)을 찾는다. 없으면 첫 비어있지 않은 행. */
function findHeaderRow(rows: string[][]): number {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!row) continue;
    if (row.some((c) => norm(c).includes('거래처'))) return r;
  }
  for (let r = 0; r < rows.length; r++) {
    if (rows[r] && rows[r].some((c) => String(c).trim() !== '')) return r;
  }
  return -1;
}

/** 이미 읽어낸 행 배열(string[][]) → 타겟처. 헤더 자동 감지·매핑의 순수 로직(테스트용). */
export function targetsFromRows(rows: string[][], campaignId: string): ParsedTargets {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) throw new Error('헤더 행을 찾지 못했습니다. 엑셀 형식을 확인하세요.');
  const headers = rows[headerIdx] ?? [];

  const codeCol = findCol(headers, ['거래처코드']);
  const nameCol = findCol(headers, ['거래처명']);
  const divCol = findCol(headers, ['사업부']);
  const teamCol = findCol(headers, ['팀']);
  const empNoCol = findCol(headers, ['담당자사번', '사번']);
  const empNameCol = findCol(headers, ['담당자명']);
  // Dr. 열 헤더는 파일마다 표기가 제각각이다. 여기서 못 잡으면 모든 행의 drName 이 ''이 되어
  // 같은 거래처의 의사들이 하나로 합쳐지므로(중복 제거) 후보를 넉넉히 둔다.
  const drCol = findCol(headers, [
    'dr명',
    'dr',
    'doctor',
    '닥터',
    '원장',
    '진료의',
    '처방의',
    '의사',
    '전문의',
    '교수',
  ]);

  if (codeCol < 0 && nameCol < 0) {
    throw new Error('‘거래처코드/거래처명’ 헤더를 찾지 못했습니다.');
  }
  if (empNoCol < 0) {
    throw new Error('‘담당자사번’ 헤더를 찾지 못했습니다.');
  }

  // 파일 기본 포맷: Dr.명 열이 있으면 병원, 없으면 의원.
  const format: TargetInstitution = drCol >= 0 ? '병원' : '의원';

  const cell = (row: string[], col: number) => (col >= 0 ? String(row[col] ?? '').trim() : '');

  // 기관유형은 사업부명을 우선한다: '병원' 포함 → 병원, '의원' 포함 → 의원. 둘 다 없으면 파일 포맷.
  const institutionFor = (division: string): TargetInstitution => {
    if (division.includes('병원')) return '병원';
    if (division.includes('의원')) return '의원';
    return format;
  };

  const targets: Target[] = [];
  const seenRow = new Set<string>(); // 완전히 동일한 행 → 진짜 중복
  const usedIds = new Set<string>(); // id 충돌 시 접미사로 분리
  let skippedRows = 0;

  // 병합 셀 대비: 한 병원에 Dr.가 여러 명이면 거래처코드/거래처명/사업부/팀 칸을 세로 병합해두는
  // 파일이 흔하다. 병합 셀은 첫 행에만 값이 있으므로 이어받지 않으면 2번째 Dr.부터 통째로 누락된다.
  // (담당자사번은 배정 주체라 이어받지 않는다 — 비면 그 행은 건너뛰고 skippedRows 로 알린다.)
  const carryCols = [codeCol, nameCol, divCol, teamCol, empNameCol].filter((c) => c >= 0);
  const carry: Record<number, string> = {};

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    // 매핑된 컬럼이 전부 빈 행은 데이터 행이 아니다(병합 이어받기도 하지 않는다).
    const mapped = [...carryCols, empNoCol, drCol].filter((c) => c >= 0);
    if (!mapped.some((c) => cell(row, c) !== '')) continue;

    for (const c of carryCols) {
      const v = cell(row, c);
      if (v) carry[c] = v;
    }
    const filled = (col: number) => (col >= 0 ? cell(row, col) || carry[col] || '' : '');

    const code = filled(codeCol);
    const name = filled(nameCol);
    const empNo = cell(row, empNoCol);
    // 최소한 거래처(코드 또는 명)와 사번이 있어야 유효 행
    if ((!code && !name) || !empNo) {
      skippedRows++;
      continue;
    }

    const drName = cell(row, drCol);
    const division = filled(divCol);
    const team = filled(teamCol);
    const empName = filled(empNameCol);

    // 내용이 완전히 같은 행만 진짜 중복으로 보고 제거한다.
    const sig = [code, name, drName, division, team, empNo, empName].join('');
    if (seenRow.has(sig)) continue;
    seenRow.add(sig);

    // id/중복키에 Dr.명 포함 → 같은 병원(거래처+사번)에 의사가 여러 명이면 각각 별도 타겟이 된다.
    // 의원(drName='')은 키가 그대로라 동작 변화 없음.
    const baseId = makeTargetId(campaignId, code, name, drName, empNo);
    // 내용은 다른데 id 가 겹치면(Dr.명 열이 없거나 비어 구분이 안 되는 파일, 또는 120자 절단)
    // 조용히 사라지지 않도록 접미사를 붙여 분리한다.
    let id = baseId;
    for (let n = 2; usedIds.has(id); n++) id = `${baseId}__${n}`;
    usedIds.add(id);

    targets.push({
      id,
      campaignId,
      code,
      name,
      institutionType: institutionFor(division),
      drName,
      division,
      team,
      empNo,
      empName,
    });
  }

  if (targets.length === 0) {
    throw new Error('유효한 타겟처 데이터를 한 건도 읽지 못했습니다. 엑셀 형식을 확인하세요.');
  }
  return { format, targets, skippedRows };
}

export async function parseTargetsXlsx(
  input: File | Blob | ArrayBuffer | Uint8Array,
  campaignId: string,
): Promise<ParsedTargets> {
  const rows = await readXlsxRows(input);
  return targetsFromRows(rows, campaignId);
}
