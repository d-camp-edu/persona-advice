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
  Product,
  RxSession,
  SurveyQuestion,
  SurveyResponse,
  TargetCampaign,
  TargetCompletion,
} from '../types';
import type { CellValue, Sheet } from './excel';

/** 한국 표준시 오프셋. 한국은 서머타임이 없어 고정 +9로 안전하다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * ISO 문자열 → 한국시간 'YYYY-MM-DD HH:mm'.
 *
 * 저장값은 전부 `new Date().toISOString()` = UTC 다. 예전엔 이 문자열을 그냥 잘라 써서
 * 엑셀의 모든 시각이 KST 보다 9시간 일렀고, 자정 넘어 진행한 건은 날짜까지 하루 밀렸다.
 * (예: 8/25 13:15 진행 → '2026-08-25 04:15')
 *
 * 타임존 표기가 없는 값은 이미 로컬 시각으로 보고 그대로 둔다(옛/외부 데이터 방어).
 */
export function fmtTs(iso: string | undefined): string {
  if (!iso) return '';
  if (/(Z|[+-]d{2}:?d{2})$/.test(iso)) {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) {
      return new Date(t + KST_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
    }
  }
  return iso.slice(0, 16).replace('T', ' ');
}

/** 두 ISO 시각의 절대 차이(ms). 하나라도 못 읽으면 '가장 먼 것'으로 취급. */
function timeDiff(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(ta - tb);
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
  /** 품목 지정 질문의 열 헤더에 품목명을 붙이기 위한 목록 (없으면 질문 문구만 쓴다) */
  products?: Product[];
}

/**
 * 통합 시트 1장을 만든다.
 * 반환 시트를 그대로 `downloadWorkbook(filename, [sheet])` 에 넘기면 된다.
 */
export function buildUnifiedSheet(input: UnifiedInput): Sheet {
  const {
    sessions,
    surveys,
    giftLogs,
    completions,
    questions,
    loginFields,
    campaigns = [],
    products = [],
  } = input;

  const fields = [...loginFields].sort((a, b) => a.order - b.order);
  const sortedQ = [...questions].sort((a, b) => a.order - b.order);
  // 품목별로 문구가 비슷한 질문이 여러 개 생기므로 열 헤더에 품목명을 붙여 구분한다.
  // 품목 지정이 없는 공통 질문은 종전처럼 질문 문구만 쓴다 (기존 엑셀 열 이름 보존).
  const questionHeader = (q: SurveyQuestion): string => {
    const scope = q.productScope ?? [];
    if (scope.length === 0) return q.text;
    const names = scope.map((id) => products.find((p) => p.id === id)?.name ?? id);
    return `[${names.join('·')}] ${q.text}`;
  };
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
  // **완료 1건은 세션 1개에만 붙는다** (그 세션의 여러 환자 행에는 반복 표기).
  //
  // 옛 기록(sessionDocId 없음)의 폴백 키는 사번+거래처명+의사명뿐이라 품목·캠페인이
  // 들어있지 않다. 예전엔 이걸 Map.set 으로 담아 키가 겹치면 마지막 1건만 남았고,
  //   ① 살아남은 1건이 다른 품목의 세션에도 그대로 붙어 같은 시각이 양쪽에 찍혔고
  //   ② 밀려난 건은 실제 시연 행이 아니라 아래쪽 단독 행으로만 나왔다.
  // 이제 (완료 × 세션) 후보 쌍을 시각 차이 오름차순으로 그리디 배정하고, 완료도
  // 세션도 한 번씩만 쓴다. 정렬 기준이 전역이라 순회 순서에 결과가 흔들리지 않는다.
  interface SessionMeta {
    sessionDocId: string;
    empNo: string;
    hospital: string;
    doctor: string;
    /** 그 세션의 가장 이른 활동 시각 (완료 시각과의 근접도 비교용) */
    time: string;
  }
  const metaById = new Map<string, SessionMeta>();
  for (const g of groups.values()) {
    const s = g.session;
    const sv = g.surveys[0];
    const times = [
      s?.createdAt,
      ...g.prescriptions.map((p) => p.timestamp),
      ...g.surveys.map((x) => x.answeredAt),
      ...g.giftLogs.map((x) => x.spunAt),
    ].filter((t): t is string => Boolean(t));
    times.sort();
    const meta: SessionMeta = {
      sessionDocId: g.sessionDocId,
      empNo:
        s?.empNo || s?.loginFieldValues?.['사번'] || sv?.empNo || sv?.loginFieldValues?.['사번'] || '',
      hospital: s?.hospitalName || sv?.hospitalName || '',
      doctor: s?.doctorName || sv?.doctorName || '',
      time: times[0] ?? '',
    };
    const prev = metaById.get(g.sessionDocId);
    if (!prev) {
      metaById.set(g.sessionDocId, meta);
    } else {
      // 같은 세션의 다른 환자 그룹에서 빠진 값을 채우고, 시각은 더 이른 쪽을 쓴다.
      prev.empNo ||= meta.empNo;
      prev.hospital ||= meta.hospital;
      prev.doctor ||= meta.doctor;
      if (meta.time && (!prev.time || meta.time < prev.time)) prev.time = meta.time;
    }
  }

  const compForSession = new Map<string, TargetCompletion>();
  const usedCompIds = new Set<string>();

  // 1순위: sessionDocId 직접 매칭 (신규 기록)
  for (const c of completions) {
    if (!c.sessionDocId) continue;
    if (!metaById.has(c.sessionDocId)) continue; // 시연 기록이 없는 완료 → 아래 4)에서 단독 행
    if (compForSession.has(c.sessionDocId)) continue;
    compForSession.set(c.sessionDocId, c);
    usedCompIds.add(c.id);
  }

  // 2순위: 폴백 키 후보쌍을 시각 차이순으로 그리디 배정
  const metaByLegacy = new Map<string, SessionMeta[]>();
  for (const m of metaById.values()) {
    const k = legacyCompletionKey(m.empNo, m.hospital, m.doctor);
    if (!metaByLegacy.has(k)) metaByLegacy.set(k, []);
    metaByLegacy.get(k)!.push(m);
  }
  const pairs: { comp: TargetCompletion; meta: SessionMeta; diff: number }[] = [];
  for (const c of completions) {
    if (usedCompIds.has(c.id)) continue;
    const cands = metaByLegacy.get(legacyCompletionKey(c.empNo, c.name, c.doctorName)) ?? [];
    for (const m of cands) {
      pairs.push({ comp: c, meta: m, diff: timeDiff(c.completedAt, m.time) });
    }
  }
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  pairs.sort(
    (a, b) =>
      a.diff - b.diff ||
      cmp(a.comp.completedAt, b.comp.completedAt) ||
      cmp(a.comp.id, b.comp.id) ||
      cmp(a.meta.sessionDocId, b.meta.sessionDocId),
  );
  for (const p of pairs) {
    if (usedCompIds.has(p.comp.id)) continue;
    if (compForSession.has(p.meta.sessionDocId)) continue;
    compForSession.set(p.meta.sessionDocId, p.comp);
    usedCompIds.add(p.comp.id);
  }

  const completionFor = (g: Group): TargetCompletion | undefined =>
    compForSession.get(g.sessionDocId);

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
    ...sortedQ.map(questionHeader),
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

      // prescribedDrugs.slot 은 1-based(1~5, prescription.ts 참조). 급여 1~3 / 본인부담 4~5.
      const drugs = Array.from({ length: 5 }, (_, i) => {
        const found = p?.prescribedDrugs.find((d) => d.slot === i + 1);
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
