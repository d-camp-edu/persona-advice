/**
 * Firebase 프로젝트 설정.
 *
 * 실제 사용 시에는 Firebase Console에서 받은 값으로 모두 채운다.
 * 미설정 상태(아래 placeholder 그대로)면 앱은 Firebase 없이 시드 데이터만으로
 * 읽기 전용 fallback 모드로 동작한다.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/**
 * 컬렉션 경로 prefix `artifacts/{APP_ID}/public/data/...`에 사용되는 식별자.
 * 같은 Firebase 프로젝트에서 여러 앱을 분리해 운용할 때 구분자 역할.
 */
export const APP_ID = 'persona-rx';

export const isFirebaseConfigured = (): boolean =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
