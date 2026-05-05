import { describe, it, expect } from 'vitest';
import { makeSessionKey, makeSessionDocId } from '../src/lib/sessionKey';

describe('makeSessionKey', () => {
  it('한글 그대로 보존', () => {
    expect(makeSessionKey('서울대학교병원', '홍길동')).toBe('서울대학교병원_홍길동');
  });

  it('공백 제거', () => {
    expect(makeSessionKey(' 서울대학교 병원 ', '홍 길동')).toBe('서울대학교병원_홍길동');
  });

  it('특수문자 제거', () => {
    expect(makeSessionKey('서울/대학교?병원!', '홍.길.동')).toBe('서울대학교병원_홍길동');
  });

  it('Firestore 금지 문자 제거', () => {
    // /, ., __ 등이 들어가지 않아야 함
    const k = makeSessionKey('A/B.C', 'D__E');
    expect(k).not.toMatch(/[/.]/);
  });
});

describe('makeSessionDocId', () => {
  it('타임스탬프가 붙는다', () => {
    expect(makeSessionDocId('서울대학교병원_홍길동', 1714800000000)).toBe(
      '서울대학교병원_홍길동_1714800000000',
    );
  });
});
