// 이력 엑셀 '통합' 시트 빌더.
//
// 기존에는 처방·서베이·룰렛·타겟진행이 각각 별도 탭이었는데, 한 방문에서 일어난 일을
// 한 줄로 보고 싶다는 요구에 따라 시트 1장으로 합친다.
//
// 행 기준 = **세션 × 환자**.
//   - 같은 환자에게 처방을 2번 하면 회차별로 2행.
//   - 서베이/룰렛은 같은 (세션, 환자)의 같은 순번 행에 붙고, 남으면 아래 행으로 흘러간다.
//   - 서베이만 하고 처방을 안 했으면 처방 칸이 공란인 1행.
//   - 타겟 '진행 완료'는 세션 단위라 그 세션의 첫 행에만 표기한다(중복 합산 방지).
//
// 모두 순수 함수 — Firestore/React 의존 없음.

import type {
  GiftLog,
  LoginFieldDef,
  Prescription,
  RxSession,
  SurveyQuestion,
  SurveyResponse,
  TargetCampaign,
  TargetCompletion,
} from '../types';
import type { CellValue, Sheet } from './excel';

/** ISO 문자열 → 'YYYY-MM-DD HH:mm' */
export function fmtTs(iso: string | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 16).replace('T', ' ');
}

function answerText(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(', ');
  return v ?? '';
}

/** 세션×환자 그룹 키. patientId 가 없는 옛 기록은 이름으로 대체한다. */
function groupKey(sessionDocId: string, patientId?: string, patientName?: string): string {
  return `${sessionDocId} ${patientId || patientName || ''}`;
}

/** 레거시 완료 기록(sessionDocId 없음) 매칭용 키 */
function legacyCompletionKey(empNo: string, name: string, doctorName: string): string {
  return `${(empNo || '').trim()} ${(name || '').trim()} ${(doctorName || '').trim()}`;
}

interface Group {
  sessionDocId: string;
  patientName: string;
  session?: RxSession;
  prescriptions: Prescription[];
  surveys: SurveyResponse[];
  giftLogs: GiftLog[];
}

export interface UnifiedInput {
  sessions: RxSession[];
  surveys: SurveyResponse[];
  giftLogs: GiftLog[];
  completions: TargetCompletion[];
  questions: SurveyQuestion[];
  loginFields: LoginFieldDef[];
  campaigns?: TargetCampaign[];
}

/**
 * 통합 시트 1장을 만든다.
 * 반환 시트를 그대로 `downloadWorkbook(filename, [sheet])` 에 넘기면 된다.
 */
export function buildUnifiedSheet(input: UnifiedInput): Sheet {
  const { sessions, surveys, giftLogs, completions, questions, loginFields, campaigns = [] } = input;

  const fields = [...loginFields].sort((a, b) => a.order - b.order);
  const sortedQ = [...questions].sort((a, b) => a.order - b.order);
  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name ?? '';

  // ── 1) 세션×환자 그룹 수집 ──────────────────────────────────────────────
  const groups = new Map<string, Group>();
  const sessionById = new Map<string, RxSession>();

  const touch = (
    sessionDocId: string,
    patientId: string | undefined,
    patientName: string | undefined,
  ): Group => {
    const key = groupKey(sessionDocId, patientId, patientName);
    let g = groups.get(key);
    if (!g) {
      g = {
        sessionDocId,
        patientName: patientName ?? '',
        session: sessionById.get(sessionDocId),
        prescriptions: [],
        surveys: [],
        giftLogs: [],
      };
      groups.set(key, g);
    }
    // 나중에 들어온 소스가 환자명을 갖고 있으면 채운다.
    if (!g.patientName && patientName) g.patientName = patientName;
    if (!g.session) g.session = sessionById.get(sessionDocId);
    return g;
  };

  for (const s of sessions) sessionById.set(s.id, s);

  for (const s of sessions) {
    if (s.prescriptions.length === 0) {
      // 처방이 하나도 없는 세션도 (서베이/룰렛이 있으면) 아래에서 그룹이 생긴다.
      continue;
    }
    for (const p of s.prescriptions) {
      touch(s.id, p.patientId, p.patientName).prescriptions.push(p);
    }
  }
  for (const sv of surveys) {
    touch(sv.sessionDocId, sv.patientId, sv.patientName).surveys.push(sv);
  }
  for (const gl of giftLogs) {
    touch(gl.sessionDocId, gl.patientId, gl.patientName).giftLogs.push(gl);
  }

  // 처방·서베이·룰렛이 하나도 없는 세션도 한 줄은 남긴다(방문 기록 자체).
  const sessionsWithGroup = new Set([...groups.values()].map((g) => g.sessionDocId));
  for (const s of sessions) {
    if (!sessionsWithGroup.has(s.id)) touch(s.id, undefined, undefined);
  }

  // ── 2) 타겟 완료 매칭 ──────────────────────────────────────────────────
  // 신규 기록은 sessionDocId 로, 옛 기록은 사번+거래처명+의사명으로 붙인다.
  const compBySession = new Map<string, TargetCompletion>();
  const compByLegacy = new Map<string, TargetCompletion>();
  for (const c of completions) {
    if (c.sessionDocId) compBySession.set(c.sessionDocId, c);
    else compByLegacy.set(legacyCompletionKey(c.empNo, c.name, c.doctorName), c);
  }

  const completionFor = (g: Group): TargetCompletion | undefined => {
    const bySession = compBySession.get(g.sessionDocId);
    if (bySession) return bySession;
    const s = g.session;
    const sv = g.surveys[0];
    const empNo = s?.empNo || s?.loginFieldValues?.['사번'] || sv?.empNo || sv?.loginFieldValues?.['사번'] || '';
    const hospital = s?.hospitalName || sv?.hospitalName || '';
    const doctor = s?.doctorName || sv?.doctorName || '';
    return compByLegacy.get(legacyCompletionKey(empNo, hospital, doctor));
  };

  // ── 3) 행 생성 ────────────────────────────────────────────────────────
  const headers = [
    '일시',
    '사번',
    '담당자',
    '연락처',
    '사업부',
    '팀',
    '품목',
    '캠페인',
    '거래처코드',
    '거래처명',
    '기관유형',
    '병원',
    '분과',
    '의사',
    '환자',
    '약제1',
    '약제2',
    '약제3',
    '약제4',
    '약제5',
    '이전HbA1c',
    '새HbA1c',
    '부작용',
    '삭감사유',
    '병포장보너스',
    '순응도나쁨',
    '서베이일시',
    ...sortedQ.map((q) => q.text),
    '룰렛결과',
    '당첨여부',
    '타겟완료일시',
    ...fields.map((f) => f.label),
  ];

  interface Emitted {
    ts: string;
    cells: CellValue[];
  }
  const emitted: Emitted[] = [];
  // 타겟 완료 1건은 전체에서 딱 한 행에만 찍는다(중복 합산 방지).
  const stampedCompIds = new Set<string>();

  const sortByTime = <T,>(arr: T[], pick: (x: T) => string): T[] =>
    [...arr].sort((a, b) => (pick(a) < pick(b) ? -1 : pick(a) > pick(b) ? 1 : 0));

  for (const g of groups.values()) {
    const rx = sortByTime(g.prescriptions, (p) => p.timestamp);
    const sv = sortByTime(g.surveys, (s) => s.answeredAt);
    const gl = sortByTime(g.giftLogs, (x) => x.spunAt);
    const rowCount = Math.max(rx.length, sv.length, gl.length, 1);

    const s = g.session;
    const anySurvey = sv[0];
    const anyGift = gl[0];
    const comp = completionFor(g);

    const loginFieldValues =
      s?.loginFieldValues ?? anySurvey?.loginFieldValues ?? anyGift?.loginFieldValues ?? {};
    const empNo = s?.empNo || loginFieldValues['사번'] || anySurvey?.empNo || comp?.empNo || '';
    const empName = loginFieldValues['담당자'] || comp?.empName || '';
    const empPhone = loginFieldValues['연락처'] || comp?.empPhone || '';
    const hospitalName = s?.hospitalName || anySurvey?.hospitalName || anyGift?.hospitalName || comp?.name || '';
    const department = s?.department || anySurvey?.department || anyGift?.department || '';
    const doctorName = s?.doctorName || anySurvey?.doctorName || anyGift?.doctorName || comp?.doctorName || '';
    const institutionType =
      s?.institutionType || anySurvey?.institutionType || anyGift?.institutionType || comp?.institutionType || '';

    for (let i = 0; i < rowCount; i++) {
      const p = rx[i];
      const v = sv[i];
      const gift = gl[i];

      const drugs = Array.from({ length: 5 }, (_, slot) => {
        const found = p?.prescribedDrugs.find((d) => d.slot === slot);
        return found ? found.name : '';
      });

      // 매칭된 첫 행에만 타겟 완료일시를 찍는다.
      let completedAt: CellValue = '';
      if (comp && !stampedCompIds.has(comp.id)) {
        completedAt = fmtTs(comp.completedAt);
        stampedCompIds.add(comp.id);
      }

      const ts = p?.timestamp || v?.answeredAt || gift?.spunAt || s?.createdAt || comp?.completedAt || '';

      emitted.push({
        ts,
        cells: [
          fmtTs(ts),
          empNo,
          empName,
          empPhone,
          comp?.division ?? '',
          comp?.team ?? '',
          comp?.productName ?? '',
          comp ? campaignName(comp.campaignId) : '',
          comp?.code ?? '',
          comp?.name ?? '',
          institutionType,
          hospitalName,
          department,
          doctorName,
          g.patientName || p?.patientName || v?.patientName || gift?.patientName || '',
          ...drugs,
          p ? Number(p.oldHba1c.toFixed(1)) : '',
          p ? Number(p.newHba1c.toFixed(1)) : '',
          p ? p.sideEffects.join('; ') : '',
          p ? p.deductionReasons.join('; ') : '',
          p?.isPackagingBonus ? 'O' : '',
          p?.isPoorAdherence ? 'O' : '',
          v ? fmtTs(v.answeredAt) : '',
          ...sortedQ.map((q) => (v ? answerText(v.answers?.[q.id]) : '')),
          gift ? gift.giftName : '',
          gift ? (gift.isWin ? '당첨' : '꽝') : '',
          completedAt,
          ...fields.map((f) => loginFieldValues[f.id] ?? ''),
        ],
      });
    }
  }

  // ── 4) 세션에 붙지 못한 타겟 완료(시연 기록 없이 완료만 남은 경우) ──────
  for (const c of completions) {
    if (stampedCompIds.has(c.id)) continue;
    emitted.push({
      ts: c.completedAt,
      cells: [
        fmtTs(c.completedAt),
        c.empNo,
        c.empName,
        c.empPhone ?? '',
        c.division,
        c.team,
        c.productName ?? '',
        campaignName(c.campaignId),
        c.code,
        c.name,
        c.institutionType,
        c.name,
        '',
        c.doctorName,
        '',
        ...Array.from({ length: 5 }, () => ''),
        '', // 이전HbA1c
        '', // 새HbA1c
        '', // 부작용
        '', // 삭감사유
        '', // 병포장보너스
        '', // 순응도나쁨
        '', // 서베이일시
        ...sortedQ.map(() => ''),
        '', // 룰렛결과
        '', // 당첨여부
        fmtTs(c.completedAt),
        ...fields.map(() => ''),
      ],
    });
  }

  // 최신 기록이 위로 오도록 정렬
  emitted.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  return { name: '통합', headers, rows: emitted.map((e) => e.cells) };
}
