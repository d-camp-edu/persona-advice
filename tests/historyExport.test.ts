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
              prescribedDrugs: [
                { slot: 0, id: 'm1', name: '자누비아', classes: [], isSelfPay: false },
                { slot: 1, id: 'm2', name: '메트포르민', classes: [], isSelfPay: false },
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
    expect(cell(sheet, 0, '타겟완료일시')).toBe('2026-08-25 10:06');
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
    expect(cell(sheet, 0, '타겟완료일시')).toBe('2026-08-25 10:06');
    expect(cell(sheet, 0, '거래처코드')).toBe('A1023');
  });

  it('시연 기록이 전혀 없는 완료도 자체 행으로 남는다', () => {
    const sheet = buildUnifiedSheet({
      ...empty,
      completions: [completion({ sessionDocId: 'no-such-session', empNo: '99999' })],
    });
    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '사번')).toBe('99999');
    expect(cell(sheet, 0, '타겟완료일시')).toBe('2026-08-25 10:06');
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

  it('처방·서베이·룰렛이 없는 세션도 방문 기록으로 1행 남는다', () => {
    const sheet = buildUnifiedSheet({ ...empty, sessions: [session({})] });
    expect(sheet.rows).toHaveLength(1);
    expect(cell(sheet, 0, '병원')).toBe('서울내과');
    expect(cell(sheet, 0, '일시')).toBe('2026-08-25 09:00');
  });
});
