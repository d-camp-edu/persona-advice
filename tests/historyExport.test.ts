import { describe, expect, it } from 'vitest';
import { buildUnifiedSheet } from '../src/lib/historyExport';
import type {
  GiftLog,
  LoginFieldDef,
  Prescription,
  RxSession,
  SurveyQuestion,
  SurveyResponse,
  TargetCampaign,
  TargetCompletion,
} from '../src/types';

const rx = (over: Partial<Prescription>): Prescription => ({
  id: 'p1',
  patientId: 'pt1',
  patientName: '홍길동',
  prescribedDrugs: [],
  insuranceCodes: [],
  oldHba1c: 8.1,
  newHba1c: 7.2,
  oldWeight: 80,
  newWeight: 79,
  oldLvef: '',
  newLvef: '',
  oldNyha: '',
  newNyha: '',
  oldBnp: '',
  newBnp: '',
  oldNtprobnp: '',
  newNtprobnp: '',
  oldEgfr: '',
  newEgfr: '',
  oldUacr: '',
  newUacr: '',
  sideEffects: [],
  deductionReasons: [],
  patientFeedback: '',
  comorbFeedback: {},
  isPackagingBonus: false,
  isPoorAdherence: false,
  timestamp: '2026-08-25T10:00:00.000Z',
  ...over,
});

const session = (over: Partial<RxSession>): RxSession => ({
  id: 'sess1',
  hospitalName: '서울내과',
  doctorName: '김의사',
  department: '',
  institutionType: '의원',
  sessionKey: 'k',
  createdAt: '2026-08-25T09:00:00.000Z',
  prescriptions: [],
  loginFieldValues: { 사번: '12345', 담당자: '김담당', 연락처: '010-0000-0000' },
  empNo: '12345',
  ...over,
});

const survey = (over: Partial<SurveyResponse>): SurveyResponse => ({
  id: 'sv1',
  sessionDocId: 'sess1',
  doctorName: '김의사',
  hospitalName: '서울내과',
  institutionType: '의원',
  patientId: 'pt1',
  patientName: '홍길동',
  answeredAt: '2026-08-25T10:05:00.000Z',
  answers: {},
  loginFieldValues: { 사번: '12345', 담당자: '김담당' },
  ...over,
});

const giftLog = (over: Partial<GiftLog>): GiftLog => ({
  id: 'g1',
  sessionDocId: 'sess1',
  sessionKey: 'k',
  hospitalName: '서울내과',
  doctorName: '김의사',
  institutionType: '의원',
  patientId: 'pt1',
  patientName: '홍길동',
  giftId: 'gift_coffee',
  giftName: '커피 기프티콘',
  isWin: true,
  spunAt: '2026-08-25T10:10:00.000Z',
  ...over,
});

const completion = (over: Partial<TargetCompletion>): TargetCompletion => ({
  id: 'camp1__t1',
  campaignId: 'camp1',
  productId: 'prod1',
  productName: '자디앙',
  targetId: 't1',
  code: 'A1023',
  name: '서울내과',
  institutionType: '의원',
  empNo: '12345',
  empName: '김담당',
  empPhone: '010-0000-0000',
  division: '1사업부',
  team: 'A팀',
  doctorName: '김의사',
  completedAt: '2026-08-25T10:06:00.000Z',
  ...over,
});

const questions: SurveyQuestion[] = [
  { id: 'q1', order: 1, text: '만족하셨나요?', type: 'single', options: ['예', '아니오'], required: true },
  { id: 'q2', order: 2, text: '자유 의견', type: 'text', options: [], required: false },
];

const loginFields: LoginFieldDef[] = [];

const campaigns: TargetCampaign[] = [
  {
    id: 'camp1',
    name: '8월 자디앙 디테일',
    productId: 'prod1',
    month: '2026-08',
    startDate: '',
    endDate: '',
    active: true,
    createdAt: '',
  },
];

const empty = {
  sessions: [],
  surveys: [],
  giftLogs: [],
  completions: [],
  questions,
  loginFields,
  campaigns,
};

/** 헤더명으로 셀을 꺼내는 헬퍼 */
function cell(sheet: ReturnType<typeof buildUnifiedSheet>, row: number, header: string) {
  const i = sheet.headers.indexOf(header);
  expect(i, `헤더 '${header}' 없음`).toBeGreaterThanOrEqual(0);
  return sheet.rows[row][i];
}

describe('buildUnifiedSheet', () => {
  it('데이터가 없으면 헤더만 있는 빈 시트', () => {
    const sheet = buildUnifiedSheet(empty);
    expect(sheet.name).toBe('통합');
    expect(sheet.rows).toEqual([]);
    expect(sheet.headers).toContain('환자');
    expect(sheet.headers).toContain('만족하셨나요?');
  });

  it('처방 + 서베이 + 룰렛 + 타겟완료가 한 행으로 합쳐진다', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      sessions: [
        session({
          prescriptions: [
            rx({
              // slot 은 1-based (급여 1~3 / 본인부담 4~5)
              prescribedDrugs: [
                { slot: 1, id: 'm1', name: '자누비아', classes: [], isSelfPay: false },
                { slot: 2, id: 'm2', name: '메트포르민', classes: [], isSelfPay: false },
              ],
            }),
          ],
        }),
      ],
      surveys: [survey({ answers: { q1: '예', q2: '좋았습니다' } })],
      giftLogs: [giftLog({})],
      completions: [completion({ sessionDocId: 'sess1' })],
    });

    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '환자')).toBe('홍길동');
    expect(cell(sheet, 0, '약제1')).toBe('자누비아');
    expect(cell(sheet, 0, '약제2')).toBe('메트포르민');
    expect(cell(sheet, 0, '약제3')).toBe('');
    expect(cell(sheet, 0, '이전HbA1c')).toBe(8.1);
    expect(cell(sheet, 0, '새HbA1c')).toBe(7.2);
    expect(cell(sheet, 0, '만족하셨나요?')).toBe('예');
    expect(cell(sheet, 0, '자유 의견')).toBe('좋았습니다');
    expect(cell(sheet, 0, '룰렛결과')).toBe('커피 기프티콘');
    expect(cell(sheet, 0, '당첨여부')).toBe('당첨');
    expect(cell(sheet, 0, '사번')).toBe('12345');
    expect(cell(sheet, 0, '담당자')).toBe('김담당');
    expect(cell(sheet, 0, '사업부')).toBe('1사업부');
    expect(cell(sheet, 0, '팀')).toBe('A팀');
    expect(cell(sheet, 0, '품목')).toBe('자디앙');
    expect(cell(sheet, 0, '캠페인')).toBe('8월 자디앙 디테일');
    expect(cell(sheet, 0, '거래처코드')).toBe('A1023');
    expect(cell(sheet, 0, '타겟완료일시')).toBe('2026-08-25 19:06');
  });

  it('약제1~5 컬럼이 급여1~3·본인부담1~2 슬롯과 1:1로 맞는다', () => {
    // prescribedDrugs.slot 은 1-based. 0-based 로 조회하면 약제1 이 비고 본인부담2 가 누락된다.
    const sheet = buildUnifiedSheet({
      ...empty,
      sessions: [
        session({
          prescriptions: [
            rx({
              prescribedDrugs: [
                { slot: 1, id: 'a', name: '급여1약', classes: [], isSelfPay: false },
                { slot: 2, id: 'b', name: '급여2약', classes: [], isSelfPay: false },
                { slot: 3, id: 'c', name: '급여3약', classes: [], isSelfPay: false },
                { slot: 4, id: 'd', name: '본인부담1약', classes: [], isSelfPay: true },
                { slot: 5, id: 'e', name: '본인부담2약', classes: [], isSelfPay: true },
              ],
            }),
          ],
        }),
      ],
    });
    expect(cell(sheet, 0, '약제1')).toBe('급여1약');
    expect(cell(sheet, 0, '약제2')).toBe('급여2약');
    expect(cell(sheet, 0, '약제3')).toBe('급여3약');
    expect(cell(sheet, 0, '약제4')).toBe('본인부담1약');
    expect(cell(sheet, 0, '약제5')).toBe('본인부담2약');
  });

  it('서베이만 있으면 처방 칸은 공란', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      surveys: [survey({ answers: { q1: '아니오' } })],
    });

    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '약제1')).toBe('');
    expect(cell(sheet, 0, '이전HbA1c')).toBe('');
    expect(cell(sheet, 0, '새HbA1c')).toBe('');
    expect(cell(sheet, 0, '룰렛결과')).toBe('');
    expect(cell(sheet, 0, '만족하셨나요?')).toBe('아니오');
    expect(cell(sheet, 0, '병원')).toBe('서울내과');
  });

  it('룰렛만 있어도 한 행이 나온다 (꽝 포함)', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      giftLogs: [giftLog({ giftId: '', giftName: '꽝', isWin: false })],
    });
    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '룰렛결과')).toBe('꽝');
    expect(cell(sheet, 0, '당첨여부')).toBe('꽝');
    expect(cell(sheet, 0, '만족하셨나요?')).toBe('');
  });

  it('같은 환자에게 처방 2회면 회차별 2행, 서베이·룰렛은 첫 행에만', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      sessions: [
        session({
          prescriptions: [
            rx({ id: 'p1', timestamp: '2026-08-25T10:00:00.000Z' }),
            rx({ id: 'p2', timestamp: '2026-08-25T10:30:00.000Z', oldHba1c: 7.2, newHba1c: 6.8 }),
          ],
        }),
      ],
      surveys: [survey({ answers: { q1: '예' } })],
      giftLogs: [giftLog({})],
    });

    expect(sheet.rows).toHaveLength(2);
    // 최신 처방이 위로 정렬됨
    expect(cell(sheet, 0, '새HbA1c')).toBe(6.8);
    expect(cell(sheet, 1, '새HbA1c')).toBe(7.2);
    // 서베이/룰렛은 처방 시간순 첫 회차(=아래 행)에 붙는다
    expect(cell(sheet, 1, '만족하셨나요?')).toBe('예');
    expect(cell(sheet, 1, '룰렛결과')).toBe('커피 기프티콘');
    expect(cell(sheet, 0, '만족하셨나요?')).toBe('');
    expect(cell(sheet, 0, '룰렛결과')).toBe('');
  });

  it('환자가 다르면 다른 행으로 분리된다', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      sessions: [
        session({
          prescriptions: [
            rx({ id: 'p1', patientId: 'pt1', patientName: '홍길동' }),
            rx({ id: 'p2', patientId: 'pt2', patientName: '이순신', timestamp: '2026-08-25T11:00:00.000Z' }),
          ],
        }),
      ],
    });
    expect(sheet.rows).toHaveLength(2);
    expect(cell(sheet, 0, '환자')).toBe('이순신');
    expect(cell(sheet, 1, '환자')).toBe('홍길동');
  });

  it('타겟 완료는 여러 행이 있어도 딱 한 번만 표기된다', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      sessions: [
        session({
          prescriptions: [
            rx({ id: 'p1', patientId: 'pt1', patientName: '홍길동' }),
            rx({ id: 'p2', patientId: 'pt2', patientName: '이순신' }),
          ],
        }),
      ],
      completions: [completion({ sessionDocId: 'sess1' })],
    });
    const stamped = sheet.rows.filter((_, i) => cell(sheet, i, '타겟완료일시') !== '');
    expect(stamped).toHaveLength(1);
    // 사업부/팀 같은 식별 정보는 모든 행에 반복된다
    expect(cell(sheet, 0, '사업부')).toBe('1사업부');
    expect(cell(sheet, 1, '사업부')).toBe('1사업부');
  });

  it('sessionDocId 없는 옛 완료 기록은 사번+거래처명+의사명으로 붙는다', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      surveys: [survey({})],
      completions: [completion({ sessionDocId: undefined })],
    });
    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '타겟완료일시')).toBe('2026-08-25 19:06');
    expect(cell(sheet, 0, '거래처코드')).toBe('A1023');
  });

  it('시연 기록이 전혀 없는 완료도 자체 행으로 남는다', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      completions: [completion({ sessionDocId: 'no-such-session', empNo: '99999' })],
    });
    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '사번')).toBe('99999');
    expect(cell(sheet, 0, '타겟완료일시')).toBe('2026-08-25 19:06');
    expect(cell(sheet, 0, '환자')).toBe('');
  });

  it('모든 행의 셀 개수가 헤더 개수와 같다', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      sessions: [session({ prescriptions: [rx({})] })],
      surveys: [survey({}), survey({ id: 'sv2', patientId: 'pt9', patientName: '유관순' })],
      giftLogs: [giftLog({})],
      completions: [completion({ sessionDocId: 'sess1' }), completion({ id: 'x', sessionDocId: 'zzz' })],
      loginFields: [{ id: 'hospital', label: '병원명', order: 1 } as LoginFieldDef],
    });
    expect(sheet.rows.length).toBeGreaterThan(0);
    for (const row of sheet.rows) {
      expect(row).toHaveLength(sheet.headers.length);
    }
  });

  // ── 시간대: 저장은 UTC, 표시는 한국시간 ──────────────────────────────
  describe('시간 표기(KST)', () => {
    it('UTC 저장값을 +9 한국시간으로 보여준다', () => {
      const sheet = buildUnifiedSheet({
        ...empty,
        sessions: [session({ prescriptions: [rx({ timestamp: '2026-08-25T04:15:24.844Z' })] })],
      });
      expect(cell(sheet, 0, '일시')).toBe('2026-08-25 13:15');
    });

    it('자정을 넘는 시각은 날짜도 하루 넘어간다', () => {
      const sheet = buildUnifiedSheet({
        ...empty,
        sessions: [session({ prescriptions: [rx({ timestamp: '2026-08-25T15:30:00.000Z' })] })],
      });
      // UTC 8/25 15:30 = KST 8/26 00:30
      expect(cell(sheet, 0, '일시')).toBe('2026-08-26 00:30');
    });

    it('타임존 표기가 없는 옛 값은 그대로 둔다(이중 변환 방지)', () => {
      const sheet = buildUnifiedSheet({
        ...empty,
        sessions: [session({ prescriptions: [rx({ timestamp: '2026-08-25T10:00:00' })] })],
      });
      expect(cell(sheet, 0, '일시')).toBe('2026-08-25 10:00');
    });
  });

  // ── 완료 1건 = 세션 1개 (품목 간 전이 방지) ───────────────────────────
  describe('타겟 완료 매칭', () => {
    // 같은 담당자가 같은 거래처를 두 품목으로 각각 진행한 경우.
    // 폴백 키(사번+거래처명+의사명)가 동일해 예전엔 한쪽 완료가 양쪽 행에 붙었다.
    const twoProductInput = {
      ...empty,
      campaigns: [
        { ...campaigns[0], id: 'campA', name: 'A품목 캠페인' },
        { ...campaigns[0], id: 'campB', name: 'B품목 캠페인' },
      ],
      sessions: [
        session({ id: 'sessA', createdAt: '2026-08-25T01:00:00.000Z',
          prescriptions: [rx({ id: 'pA', timestamp: '2026-08-25T01:05:00.000Z' })] }),
        session({ id: 'sessB', createdAt: '2026-08-25T05:00:00.000Z',
          prescriptions: [rx({ id: 'pB', timestamp: '2026-08-25T05:05:00.000Z' })] }),
      ],
      completions: [
        completion({ id: 'cA', campaignId: 'campA', productName: 'A품목',
          completedAt: '2026-08-25T01:10:00.000Z' }),
        completion({ id: 'cB', campaignId: 'campB', productName: 'B품목',
          completedAt: '2026-08-25T05:10:00.000Z' }),
      ],
    };

    it('레거시 완료 2건이 각각 시각이 가까운 세션에 하나씩 붙는다', () => {
      const sheet = buildUnifiedSheet(twoProductInput);
      const rows = sheet.rows.map((_, i) => ({
        일시: cell(sheet, i, '일시'),
        품목: cell(sheet, i, '품목'),
        캠페인: cell(sheet, i, '캠페인'),
        완료: cell(sheet, i, '타겟완료일시'),
      }));
      // 시연 기록과 무관한 단독 행이 생기지 않는다 = 완료 2건이 모두 제자리를 찾았다
      expect(rows).toHaveLength(2);

      const early = rows.find((r) => r.일시 === '2026-08-25 10:05')!; // UTC 01:05
      const late = rows.find((r) => r.일시 === '2026-08-25 14:05')!; // UTC 05:05
      expect(early.품목).toBe('A품목');
      expect(early.캠페인).toBe('A품목 캠페인');
      expect(early.완료).toBe('2026-08-25 10:10');
      expect(late.품목).toBe('B품목');
      expect(late.캠페인).toBe('B품목 캠페인');
      expect(late.완료).toBe('2026-08-25 14:10');
    });

    it('한 완료가 두 품목 행에 중복으로 찍히지 않는다', () => {
      const sheet = buildUnifiedSheet(twoProductInput);
      const stamps = sheet.rows
        .map((_, i) => cell(sheet, i, '타겟완료일시'))
        .filter((v) => v !== '');
      expect(stamps).toHaveLength(2);
      expect(new Set(stamps).size).toBe(2); // 같은 시각이 양쪽에 찍히면 1
    });

    it('입력 순서가 뒤바뀌어도 같은 결과가 나온다', () => {
      const a = buildUnifiedSheet(twoProductInput);
      const b = buildUnifiedSheet({
        ...twoProductInput,
        sessions: [...twoProductInput.sessions].reverse(),
        completions: [...twoProductInput.completions].reverse(),
      });
      expect(b.rows).toEqual(a.rows);
    });

    it('sessionDocId 가 있는 완료는 폴백보다 우선한다', () => {
      const sheet = buildUnifiedSheet({
        ...twoProductInput,
        completions: [
          // 시각상으로는 sessA 에 가깝지만 sessionDocId 가 sessB 를 가리킨다
          completion({ id: 'cB', campaignId: 'campB', productName: 'B품목',
            sessionDocId: 'sessB', completedAt: '2026-08-25T01:09:00.000Z' }),
          completion({ id: 'cA', campaignId: 'campA', productName: 'A품목',
            completedAt: '2026-08-25T01:10:00.000Z' }),
        ],
      });
      const rows = sheet.rows.map((_, i) => ({
        일시: cell(sheet, i, '일시'),
        품목: cell(sheet, i, '품목'),
      }));
      expect(rows.find((r) => r.일시 === '2026-08-25 14:05')!.품목).toBe('B품목');
      expect(rows.find((r) => r.일시 === '2026-08-25 10:05')!.품목).toBe('A품목');
    });

    it('세션 수보다 완료가 많으면 남는 완료는 단독 행으로 남는다', () => {
      const sheet = buildUnifiedSheet({
        ...twoProductInput,
        sessions: [twoProductInput.sessions[0]],
      });
      // 세션 1개 + 짝 못 찾은 완료 1건의 단독 행
      expect(sheet.rows).toHaveLength(2);
      const stamps = sheet.rows
        .map((_, i) => cell(sheet, i, '타겟완료일시'))
        .filter((v) => v !== '');
      expect(stamps).toHaveLength(2); // 완료 2건 모두 어딘가에는 찍힌다
    });
  });

  it('처방·서베이·룰렛이 없는 세션도 방문 기록으로 1행 남는다', () => {
    const sheet = buildUnifiedSheet({ ...empty, sessions: [session({})] });
    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '병원')).toBe('서울내과');
    expect(cell(sheet, 0, '일시')).toBe('2026-08-25 18:00');
  });
});
