# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 현재 상태

그린필드 디렉토리. 코드는 아직 존재하지 않으며 두 개의 한국어 스펙 문서만 있다.

- `기획.md` — 제품 스펙 전문 (화면, 데이터 모델, 처방 계산식, 보험 삭감 규칙, Firebase 스키마, Admin 콘솔 7탭)
- `계획.md` — 구현 계획 (기술 스택 선택, 폴더 구조, 마일스톤 M1–M10, 핵심 순수 함수 시그니처)

새 작업을 시작할 때는 두 문서를 모두 읽어라. **`기획.md`는 도메인의 절대 기준**(약제 60종 수치, 환자 20명 데이터, 공병증 메시지 등 단순 사실의 출처)이고 **`계획.md`는 코드 구조와 의사결정의 기준**(이미 확정된 결정 사항 포함)이다. 두 문서가 충돌하면 `계획.md`의 결정 사항을 우선한다 (예: eGFR 하한선 위반은 경고만, 차단 안 함).

## 프로젝트 목적

제약사 담당자가 의사에게 1:1로 시연하는 **당뇨 약제 처방 시뮬레이터**(Persona Rx). 모바일 우선 웹앱(`max-width: 640px`). 흐름은 로그인(병원명+의사명) → 환자 선택 → 5슬롯 처방 → 결과 리포트.

## 기술 스택 (확정)

- Vite (`react-ts` 템플릿) + React 18 + TypeScript
- Tailwind CSS, lucide-react
- **Zustand** 상태관리, 라우팅 라이브러리 미사용 (phase 기반 단일 화면 전환)
- **Firebase Firestore + Anonymous Auth** (처음부터 연동, `firebaseConfig`는 사용자가 제공)
- **Vitest** (lib 순수 함수 단위 테스트)

스캐폴딩이 끝나기 전까지는 빌드/테스트 명령이 존재하지 않는다. 스캐폴딩은 `계획.md`의 마일스톤 M1에서 진행한다.

## 아키텍처 핵심

### 도메인 로직은 `src/lib/`의 순수 함수로 분리

처방 시뮬레이션의 모든 도메인 규칙은 React/Firestore에서 분리된 순수 함수로 구현해 Vitest로 단위 테스트한다. **이 분리가 이 프로젝트의 가장 중요한 아키텍처 결정.** 5개 핵심 모듈:

- `lib/patientState.ts` — `getPatientCurrentState()` (기획.md §5-1): 같은 시연 세션 내 이전 처방이 있으면 마지막 결과를 누적해서 현재 상태로 사용, 없으면 `prevDrugs` 효과를 `initialHba1c`에서 차감.
- `lib/prescription.ts` — `calculatePrescription()` (기획.md §5-2~5-4): 약제 효과 합산, 부작용 확률 적용, **병포장 보너스**(전 약제 `pkg='bottle'`이면 HbA1c +0.3 추가 강하), **순응도 '나쁨' + 비병포장 + 약물 처방 → HbA1c가 오히려 +0.4 상승**, 결과 메시지 조합. **`rng?: () => number` 파라미터를 받아 외부 주입형으로 만들어 테스트에서 결정성 확보.**
- `lib/deductions.ts` — `checkDeductions()` (기획.md §6): E11 상병 4규칙 + DPP-4i/GLP-1 RA 병용 금지. `isInsuranceException=true` 약제와 `isNotDrug=true` 약제는 검사에서 제외.
- `lib/nonDmCoverage.ts` — `checkNonDmCoverage()` (기획.md §7): `initialHba1c < 6.5`인 비당뇨 환자에게 SGLT-2i 처방 시 HFrEF/HFpEF/CKD 특례 충족 여부.
- `lib/messages.ts` — 5-4 메시지 분기 (비약물 전용 / 부작용 발생 / 정상 / 순응도 나쁨).

부작용 면제 처리에서 두 가지를 빠뜨리기 쉽다: ① 환자가 과거 위장장애 부작용을 2회 이상 받았으면 신규 위장장애 부작용은 스킵, ② Admin이 등록한 `sideEffectExemptions` 조합에 해당하면 스킵.

### 화면 전환은 phase 문자열로

라우팅 라이브러리 없이 `useSessionStore`의 `phase` 필드로 전환: `login` → `select` → `rx` → `result` (+ `admin`). 처방 화면 내부는 별도의 `rxPhase`(`menu`/`chart`/`prescribe`/`result`)로 다시 분기.

### Zustand 스토어 3분할

- **`useDataStore`** — Firestore 마스터 데이터(환자/약제/카테고리/계열/삭감규칙/허용조합/부작용면제/설정)를 `onSnapshot`으로 구독. Admin이 변경하면 시연 화면이 자동 갱신된다.
- **`useSessionStore`** — 시연 진행 상태(병원/의사/phase/슬롯/상병/마지막 결과). `confirmPrescription()`이 도메인 함수들을 오케스트레이션하고 Firestore에 저장.
- **`useAdminStore`** — Admin 인증·탭·draft 폼 상태.

### Firestore 시드 전략 (중요)

- 시드 데이터는 `src/data/seed/*.ts`에 코드로 보관.
- **앱 부팅 시 자동 업로드 금지.** 컬렉션이 비면 시드로 화면을 그리되 읽기 전용 fallback이다.
- Admin "환자/약제/설정" 탭의 **"기본 초기화" 버튼만** `seedRunner.uploadAll()`로 batch write를 트리거.
- 시연 화면은 `useDataStore`만 참조한다. 시드 import 직접 사용 금지(seedRunner 제외).

### Firestore 경로

```
artifacts/{appId}/public/data/
  patients, medications, medCategories, drugClasses,
  deductionRules, allowedCombinations, sideEffectExemptions,
  settings/global, rx_sessions/{sessionDocId}
```

`sessionDocId`는 `{병원명}_{의사명}_{타임스탬프}` 형태이며, 세션 키 `{병원명}_{의사명}`로부터 특수문자를 제거해 만든다 (`lib/sessionKey.ts`).

## 도메인 규칙: 자주 헷갈리는 지점

- **약제 effect 부호**: HbA1c는 `effect`만큼 **차감**(양수 = 강하). 체중·LVEF·BNP·NT-proBNP·eGFR·UACR 효과는 부호 그대로 더한다 (음수 = 감소).
- **결과 리포트 색상**: HbA1c/UACR/체중/BNP/NT-proBNP는 감소가 개선(초록), 증가가 악화(빨강). LVEF/eGFR은 반대 — 증가가 개선. 변동 없는 지표는 표시 생략. 환자가 해당 수치를 가지지 않으면(`0` 또는 `""`) 행 자체를 숨긴다.
- **상병코드 검사 범위**: E11(당뇨) 처방 기준은 슬롯 1~3(보험 처방)의 약물 처방만 대상. 본인부담(슬롯 4~5), `isInsuranceException`, `isNotDrug` 약제는 제외.
- **HbA1c 하한**: `newHba1c = max(4.5, currentHba1c - effect.h)` — 4.5% 이하로 내려가지 않도록 클램프.
- **이전 복용약 누적**: `prevDrugs`는 환자 정의에 들어있는 "초기 내원 시 이력"이고, 같은 시연 세션 내 이전 처방은 `rx_sessions/{id}.prescriptions[]`의 마지막 항목에서 가져온다. 같은 병원+의사 재방문 시 이어받기는 `settings.allowSessionCarryover` 토글로 결정 (기본 false).

## 작업 시 권장 순서

1. 두 스펙 문서를 읽고, 손대는 영역이 어느 마일스톤(M1–M10)인지 식별.
2. 도메인 로직 변경이라면 먼저 `src/lib/`의 순수 함수와 `tests/*.test.ts`부터 만진다.
3. 약제·환자 시드 수치를 만질 때는 `기획.md` 표를 1차 출처로 삼고, 코드 변경 후 표와 일치하는지 다시 한번 대조한다 (오타가 시뮬레이션 결과를 통째로 무너뜨릴 수 있다).
4. UI 변경은 모바일 640px 폭으로 검증.

## 사용자 결정 사항 (재확인 불필요)

- 범위는 Admin 콘솔 7개 탭 포함 전체.
- 처음부터 Firebase 연동.
- eGFR 하한선 위반은 **경고만 표시, 처방 가능**(선택 차단 안 함).
- TypeScript + Zustand + Vitest, 라우팅 라이브러리 없음.
