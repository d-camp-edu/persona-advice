/**
 * 병원명+의사명을 Firestore document ID로 안전하게 사용할 수 있도록 정규화.
 * 한글/영숫자/언더스코어/하이픈만 남기고 나머지는 제거.
 */
export function makeSessionKey(hospitalName: string, doctorName: string): string {
  const sanitize = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^\p{L}\p{N}_-]/gu, '');
  return `${sanitize(hospitalName)}_${sanitize(doctorName)}`;
}

/**
 * 단일 처방 세션의 문서 ID. 같은 세션 키여도 시연 시점이 다르면
 * 다른 문서로 보존되도록 타임스탬프를 붙인다.
 */
export function makeSessionDocId(sessionKey: string, timestamp = Date.now()): string {
  return `${sessionKey}_${timestamp}`;
}
