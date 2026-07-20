/**
 * 관리자 비밀번호.
 *
 * 예전에는 settings/global 문서에 평문 저장했으나, 그 문서는 모든 익명
 * 클라이언트가 onSnapshot으로 구독하므로 아무 담당자나 devtools로 읽을 수
 * 있었다. Firestore 보안 규칙이 열려 있는 배포 환경에서는 어느 컬렉션에 둬도
 * 노출되므로, 비밀번호는 Firestore에서 완전히 빼고 빌드타임 환경변수로 옮긴다.
 *
 * 배포 시 `.env`(또는 호스팅 환경변수)에 `VITE_ADMIN_PASSWORD`를 설정한다.
 * 미설정이면 개발 편의를 위해 기존 기본값('1024')으로 동작한다.
 */
export const ADMIN_PASSWORD: string =
  import.meta.env.VITE_ADMIN_PASSWORD ?? '1024';
