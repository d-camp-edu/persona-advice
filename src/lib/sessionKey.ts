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
 *
 * 타임스탬프만으로는 서로 다른 담당자가 같은 거래처·Dr을 같은 밀리초에
 * 로그인하면 문서가 충돌해(setDoc 전체 덮어쓰기) 한쪽 처방이 소실될 수 있다.
 * 랜덤 접미를 덧붙여 전역 유일성을 보장한다. (테스트를 위해 주입 가능)
 */
export function makeSessionDocId(
  sessionKey: string,
  timestamp = Date.now(),
  rand: string = Math.random().toString(36).slice(2, 8),
): string {
  return `${sessionKey}_${timestamp}_${rand}`;
}
