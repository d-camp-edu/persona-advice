import { describe, it, expect } from 'vitest';
import { targetsFromRows } from '../src/lib/targetExcelImport';

// 의원 포맷: 거래처코드 · 거래처명 · 사업부명 · 팀명 · 담당자사번 · 담당자명
const clinicRows: string[][] = [
  ['거래처코드', '거래처명', '사업부명', '팀명', '담당자사번', '담당자명'],
  ['C001', '행복의원', '서울사업부', '1팀', '10001', '홍길동'],
  ['C002', '건강의원', '서울사업부', '1팀', '10001', '홍길동'],
  ['C003', '미소의원', '서울사업부', '2팀', '10002', '김영희'],
];

// 병원 포맷: 거래처코드 · 거래처명 · Dr.명 · 사업부명 · 팀명 · 담당자사번 · 담당자명
const hospitalRows: string[][] = [
  ['거래처코드', '거래처명', 'Dr.명', '사업부명', '팀명', '담당자사번', '담당자명'],
  ['H001', '서울대병원', '이순신', '병원사업부', 'A팀', '20001', '홍길동'],
  ['H002', '연세병원', '강감찬', '병원사업부', 'A팀', '20001', '홍길동'],
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

  it('병원 포맷을 감지하고 Dr.명과 담당자명을 함께 매핑한다', () => {
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
      empName: '홍길동',
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

  it('같은 병원(거래처+사번)에 Dr.명이 다르면 의사별로 각각 별도 타겟이 된다', () => {
    const multiDr: string[][] = [
      ['거래처코드', '거래처명', 'Dr.명', '사업부명', '팀명', '담당자사번', '담당자명'],
      ['H001', '서울대병원', '이순신', '병원사업부', 'A팀', '20001', '홍길동'],
      ['H001', '서울대병원', '강감찬', '병원사업부', 'A팀', '20001', '홍길동'],
      ['H001', '서울대병원', '을지문덕', '병원사업부', 'A팀', '20001', '홍길동'],
    ];
    const { targets } = targetsFromRows(multiDr, 'camp2');
    expect(targets).toHaveLength(3);
    expect(targets.map((t) => t.drName).sort()).toEqual(['강감찬', '을지문덕', '이순신']);
    // 의사별로 id 가 서로 달라야 한다
    expect(new Set(targets.map((t) => t.id)).size).toBe(3);
    // 하지만 완전히 동일한 (거래처, Dr, 사번) 행은 여전히 하나로 합쳐진다
    const withDup = targetsFromRows([...multiDr, multiDr[1]], 'camp2');
    expect(withDup.targets).toHaveLength(3);
  });

  it('거래처 칸이 세로 병합돼 비어 있어도 위 행 값을 이어받아 Dr.별로 다 읽는다', () => {
    // 실제 병원 배포 엑셀: 한 병원에 Dr.가 여러 명이면 거래처코드/거래처명/사업부/팀을 세로 병합.
    const merged: string[][] = [
      ['거래처코드', '거래처명', 'Dr.명', '사업부명', '팀명', '담당자사번', '담당자명'],
      ['H001', 'A거래처', '1닥터', '병원사업부', 'A팀', '20001', '홍길동'],
      ['', '', '2닥터', '', '', '20001', '홍길동'],
      ['H002', 'B거래처', '3닥터', '병원사업부', 'A팀', '20001', '홍길동'],
    ];
    const { targets } = targetsFromRows(merged, 'camp2');
    expect(targets).toHaveLength(3);
    expect(targets.map((t) => `${t.name}-${t.drName}`)).toEqual([
      'A거래처-1닥터',
      'A거래처-2닥터',
      'B거래처-3닥터',
    ]);
    // 병합으로 비었던 칸도 이어받는다
    expect(targets[1]).toMatchObject({ code: 'H001', division: '병원사업부', team: 'A팀' });
    expect(new Set(targets.map((t) => t.id)).size).toBe(3);
  });

  it('Dr. 열 헤더 표기가 달라도(의사명 등) 의사별로 분리된다', () => {
    const rows: string[][] = [
      ['거래처코드', '거래처명', '의사명', '사업부명', '팀명', '담당자사번'],
      ['H001', 'A거래처', '1닥터', '병원사업부', 'A팀', '20001'],
      ['H001', 'A거래처', '2닥터', '병원사업부', 'A팀', '20001'],
    ];
    const { format, targets } = targetsFromRows(rows, 'camp2');
    expect(format).toBe('병원');
    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.drName)).toEqual(['1닥터', '2닥터']);
  });

  it('id 는 같지만 내용이 다른 행은 접미사로 분리돼 사라지지 않는다', () => {
    // 같은 거래처·사번인데 팀명이 다른 행 → 예전엔 뒤 행이 조용히 사라졌다.
    const rows: string[][] = [
      ['거래처코드', '거래처명', '사업부명', '팀명', '담당자사번'],
      ['C001', '행복의원', '서울사업부', '1팀', '10001'],
      ['C001', '행복의원', '서울사업부', '2팀', '10001'],
    ];
    const { targets } = targetsFromRows(rows, 'camp1');
    expect(targets).toHaveLength(2);
    expect(new Set(targets.map((t) => t.id)).size).toBe(2);
  });

  it('사번/거래처가 없어 건너뛴 행 수를 알려준다', () => {
    const rows: string[][] = [
      ['거래처코드', '거래처명', '사업부명', '팀명', '담당자사번'],
      ['C001', '행복의원', '서울사업부', '1팀', '10001'],
      ['C002', '건강의원', '서울사업부', '1팀', ''], // 사번 없음
    ];
    const { targets, skippedRows } = targetsFromRows(rows, 'camp1');
    expect(targets).toHaveLength(1);
    expect(skippedRows).toBe(1);
  });

  it('사업부명에 병원/의원이 들어있으면 그것으로 기관유형을 분류한다', () => {
    // 파일 포맷은 Dr.명이 없어 의원이지만, 사업부명에 '병원'이 있으면 병원으로.
    const rows: string[][] = [
      ['거래처코드', '거래처명', '사업부명', '팀명', '담당자사번', '담당자명'],
      ['A1', '가나거래처', '서울병원사업부', '1팀', '10001', '홍길동'],
      ['A2', '다라거래처', '부산의원사업부', '2팀', '10002', '김영희'],
      ['A3', '마바거래처', '영업3부', '3팀', '10003', '박철수'],
    ];
    const { targets } = targetsFromRows(rows, 'camp1');
    expect(targets[0].institutionType).toBe('병원'); // 사업부명 '병원'
    expect(targets[1].institutionType).toBe('의원'); // 사업부명 '의원'
    expect(targets[2].institutionType).toBe('의원'); // 둘 다 없음 → 파일 포맷(의원)
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
