// 타겟처(지정처) 엑셀 파싱. 두 가지 포맷을 헤더명으로 자동 감지한다.
//   의원: 거래처코드 · 거래처명 · 사업부명 · 팀명 · 담당자사번 · 담당자명
//   병원: 거래처코드 · 거래처명 · Dr.명 · 사업부명 · 팀명 · 담당자사번
// 컬럼 순서가 달라도 헤더 이름으로 매핑하므로 안전하다.

import { readXlsxRows } from './xlsxReader';
import type { Target, TargetInstitution } from '../types';

export interface ParsedTargets {
  format: TargetInstitution;
  targets: Target[];
}

/** Firestore 문서 id 로 안전하게: '/'·공백·특수문자를 '_' 로 치환 */
function sanitizeId(s: string): string {
  return s
    .trim()
    .replace(/[/\\#?%*:|"<>\[\]\s]+/g, '_')
    .replace(/^\.+|\.+$/g, '_')
    .slice(0, 120);
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
  const drCol = findCol(headers, ['dr명', 'dr', '닥터']);

  if (codeCol < 0 && nameCol < 0) {
    throw new Error('‘거래처코드/거래처명’ 헤더를 찾지 못했습니다.');
  }
  if (empNoCol < 0) {
    throw new Error('‘담당자사번’ 헤더를 찾지 못했습니다.');
  }

  // 병원 포맷은 Dr.명 열이 있고, 의원 포맷은 담당자명 열이 있다.
  const format: TargetInstitution = drCol >= 0 ? '병원' : '의원';

  const cell = (row: string[], col: number) => (col >= 0 ? String(row[col] ?? '').trim() : '');

  const targets: Target[] = [];
  const seen = new Set<string>();
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const code = cell(row, codeCol);
    const name = cell(row, nameCol);
    const empNo = cell(row, empNoCol);
    // 최소한 거래처(코드 또는 명)와 사번이 있어야 유효 행
    if ((!code && !name) || !empNo) continue;

    const id = sanitizeId(`${campaignId}__${code || name}__${empNo}`);
    if (seen.has(id)) continue; // 동일 캠페인 내 (거래처, 사번) 중복 제거
    seen.add(id);

    targets.push({
      id,
      campaignId,
      code,
      name,
      institutionType: format,
      drName: cell(row, drCol),
      division: cell(row, divCol),
      team: cell(row, teamCol),
      empNo,
      empName: cell(row, empNameCol),
    });
  }

  if (targets.length === 0) {
    throw new Error('유효한 타겟처 데이터를 한 건도 읽지 못했습니다. 엑셀 형식을 확인하세요.');
  }
  return { format, targets };
}

export async function parseTargetsXlsx(
  input: File | Blob | ArrayBuffer | Uint8Array,
  campaignId: string,
): Promise<ParsedTargets> {
  const rows = await readXlsxRows(input);
  return targetsFromRows(rows, campaignId);
}
