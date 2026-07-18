import { describe, it, expect } from 'vitest';
import { targetsFromRows } from '../src/lib/targetExcelImport';

// 의원 포맷: 거래처코드 · 거래처명 · 사업부명 · 팀명 · 담당자사번 · 담당자명
const clinicRows: string[][] = [
  ['거래처코드', '거래처명', '사업부명', '팀명', '담당자사번', '담당자명'],
  ['C001', '행복의원', '서울사업부', '1팀', '10001', '홍길동'],
  ['C002', '건강의원', '서울사업부', '1팀', '10001', '홍길동'],
  ['C003', '미소의원', '서울사업부', '2팀', '10002', '김영희'],
];

// 병원 포맷: 거래처코드 · 거래처명 · Dr.명 · 사업부명 · 팀명 · 담당자사번
const hospitalRows: string[][] = [
  ['거래처코드', '거래처명', 'Dr.명', '사업부명', '팀명', '담당자사번'],
  ['H001', '서울대병원', '이순신', '병원사업부', 'A팀', '20001'],
  ['H002', '연세병원', '강감찬', '병원사업부', 'A팀', '20001'],
];

describe('targetsFromRows', () => {
  it('의원 포맷을 감지하고 담당자명을 매핑한다', () => {
    const { format, targets } = targetsFromRows(clinicRows, 'camp1');
    expect(format).toBe('의원');
    expect(targets).toHaveLength(3);
    expect(targets[0]).toMatchObject({
      campaignId: 'camp1',
      code: 'C001',
      name: '행복의원',
      institutionType: '의원',
      drName: '',
      division: '서울사업부',
      team: '1팀',
      empNo: '10001',
      empName: '홍길동',
    });
  });

  it('병원 포맷을 감지하고 Dr.명을 매핑한다 (담당자명 없음)', () => {
    const { format, targets } = targetsFromRows(hospitalRows, 'camp2');
    expect(format).toBe('병원');
    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({
      code: 'H001',
      name: '서울대병원',
      institutionType: '병원',
      drName: '이순신',
      division: '병원사업부',
      team: 'A팀',
      empNo: '20001',
      empName: '',
    });
  });

  it('컬럼 순서가 바뀌어도 헤더 이름으로 매핑한다', () => {
    const shuffled: string[][] = [
      ['담당자사번', '팀명', '거래처명', '사업부명', '거래처코드', '담당자명'],
      ['30001', '3팀', '으뜸의원', '부산사업부', 'C010', '박철수'],
    ];
    const { format, targets } = targetsFromRows(shuffled, 'camp3');
    expect(format).toBe('의원');
    expect(targets[0]).toMatchObject({
      code: 'C010',
      name: '으뜸의원',
      division: '부산사업부',
      team: '3팀',
      empNo: '30001',
      empName: '박철수',
    });
  });

  it('같은 캠페인 내 (거래처, 사번) 중복 행은 하나로 합쳐 고유 id를 만든다', () => {
    const dup: string[][] = [
      ['거래처코드', '거래처명', 'Dr.명', '사업부명', '팀명', '담당자사번'],
      ['H001', '서울대병원', '이순신', '병원사업부', 'A팀', '20001'],
      ['H001', '서울대병원', '이순신', '병원사업부', 'A팀', '20001'],
    ];
    const { targets } = targetsFromRows(dup, 'camp2');
    expect(targets).toHaveLength(1);
    // 서로 다른 캠페인이면 id 가 달라야 한다
    const other = targetsFromRows(dup, 'campX');
    expect(other.targets[0].id).not.toBe(targets[0].id);
  });

  it('거래처/사번이 비면 그 행을 건너뛴다', () => {
    const rows: string[][] = [
      ['거래처코드', '거래처명', '사업부명', '팀명', '담당자사번', '담당자명'],
      ['', '', '서울', '1팀', '10001', '홍길동'], // 거래처 없음
      ['C001', '행복의원', '서울', '1팀', '', '무담당'], // 사번 없음
      ['C002', '건강의원', '서울', '1팀', '10002', '김영희'], // 유효
    ];
    const { targets } = targetsFromRows(rows, 'camp1');
    expect(targets).toHaveLength(1);
    expect(targets[0].code).toBe('C002');
  });
});
