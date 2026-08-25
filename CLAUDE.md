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

- `lib/patientState.ts` — `getPatientCurrentState()` (기획.md §5-1 literal 해석, A안): 같은 시연 세션 내 이전 처방이 있으면 마지막 결과를 누적해서 현재 상태로 사용. 없을 때는 **type='초진'에 한해서만** `prevDrugs` 효과를 `initialHba1c`에서 차감하고(현 seed 상 초진은 prevDrugs가 비어 있어 사실상 no-op), 재진/리핏은 `initialHba1c`를 그대로 현재 HbA1c로 사용한다. 기획.md §3-4 결과 리포트 예시(p2+m_30 → 5.6)는 이 산식과 정확히 일치하지 않는 illustrative 수치다.
- `lib/prescription.ts` — `calculatePrescription()` (기획.md §5-2~5-4): 약제 효과 합산, 부작용 확률 적용, **병포장 보너스**(전 약제 `pkg='bottle'`이면 HbA1c +0.3 추가 강하), **순응도 '나쁨' + 비병포장 + 약물 처방 → HbA1c가 오히려 +0.4 상승**, 결과 메시지 조합. **`rng?: () => number` 파라미터를 받아 외부 주입형으로 만들어 테스트에서 결정성 확보.**
- `lib/deductions.ts` — `checkDeductions()` (기획.md §6): E11 상병 4규칙 + DPP-4i/GLP-1 RA 병용 금지. `isInsuranceException=true` 약제와 `isNotDrug=true` 약제는 검사에서 제외. **허용 조합(`allowedCombinations`)은 삭감 규칙보다 상위** — 아래 항목 참조.
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

#### 기본 약제 시드는 엑셀에서 생성 (중요)

- **`src/data/seed/medications.seed.ts`는 자동 생성 파일이다. 직접 손대지 말 것.** 출처는 레포 루트의 **`기본 약제 초기화.xlsx`**.
- 재생성: `node scripts/genMedications.mjs` (의존성 없음, Node 내장 zlib만 사용). 엑셀 → `medications.seed.ts`.
- **워크플로:** 사용자가 `기본 약제 초기화.xlsx`를 수정하고 커밋/푸시를 요청하면 → 위 스크립트를 다시 실행 → `medications.seed.ts` 변경분과 함께 커밋한다. 그러면 Admin "기본 초기화" 버튼이 업로드하는 기본 약제가 그대로 바뀐다.
- **주성분(`ingredient`)은 엑셀 4열 '주성분' 원문**을 그대로 담는다(복합제는 `/` 구분: `로베글리타존/엠파글리플로진/메트포르민(서방)`). 처방 약제 선택 화면(`MedSelector`)이 계열 기전과 함께 ` + `로 바꿔 보여준다. optional 필드라 이 값이 없는 기존 Firestore 문서도 그대로 동작한다(성분 줄만 숨김) — 화면에 성분이 뜨게 하려면 Admin '엑셀 반영' 또는 '기본 초기화'로 약제를 다시 올려야 한다.
- 엑셀 열 매핑·계열 파생·지표 환산 상수(LVEF/BNP/NT-proBNP/UACR %→절대량, HbA1c/eGFR 절대)는 `scripts/genMedications.mjs` 상단 주석 참조. 엑셀에 없는 값(공병증 호전/악화, eGFR 하한, 생활습관 비약물)은 계열 기준 표에서 파생·추가한다.
- **약제 구분(카테고리)은 엑셀 '카테고리' 열이 아니라 체크된 계열 수로 파생**한다: 1개→`cat_single`(단일제), 2개(biguanide 제외)→`cat_combo2`(2제 복합제), 2개(biguanide 포함)→`cat_combo_met`(메폴민 2제 복합제), 3개 이상→`cat_combo3`(3제 복합제). 포장=injection은 계열 수 무관 `cat_injection`(주사제), 생활습관 비약물은 `cat_lifestyle`. 카테고리 목록은 `medCategories.seed.ts`.
- **아사(자사) 표시(`isAsaProduct`)는 엑셀 판매사 열(0열)이 '종근당'인 행 전체**. 처방 화면(`MedSelector`)에서 아사 제품이 목록 최상단으로 정렬된다.
- 약제 id는 엑셀 데이터 행 순서 기반(`m_1`…). **행 순서를 바꾸거나 행을 추가/삭제하면 id가 밀려** `patients.seed.ts`의 `prevDrugs` 참조가 깨질 수 있다. 재생성 후 `tests/seed.test.ts`(prevDrugs 실재 검증)를 반드시 돌려 확인한다.

##### 인앱 "엑셀 반영" 버튼 (`lib/medExcelImport.ts`)

- Admin 약제 관리 탭의 **"엑셀 반영" 버튼**은 사용자가 수정한 `기본 약제 초기화.xlsx`를 **브라우저에서 직접 파싱**해 Firestore에 업로드한다(파일 선택 → 파싱 → `seedRunner.uploadMedicationList`). 매번 스크립트를 돌려 커밋하지 않아도 현장에서 반영 가능. 의존성 없이 브라우저 내장 `DecompressionStream`으로 압축 해제, inlineStr·sharedStrings(엑셀 재저장 시) 모두 지원.
- **⚠️ `lib/medExcelImport.ts`의 매핑 로직은 `scripts/genMedications.mjs`와 반드시 동일해야 한다.** 한쪽을 고치면 다른 쪽도 고쳐라. `tests/medExcelImport.test.ts`가 브라우저 파서의 결과를 커밋된 `seedMedications`와 deep-equal 비교해 드리프트를 잡는다 — 이 테스트가 깨지면 두 구현이 어긋난 것이다.

### 타겟처(영업부 배포) 시스템

영업 담당자가 **품목 선택 → 사번 입력** 순서로 배정된 지정처(타겟처)를 검색해 진입하는 배포 흐름. 기존 병원명+의사명 자유입력 로그인과 **공존**한다(로그인 화면 상단 토글: '타겟처로 시작' / '직접 입력'). **시작 화면 기본값은 항상 '타겟처로 시작'**(`LoginScreen` mode 기본 'target').

- 도메인: `types/target.ts` — `Product`(품목), `TargetCampaign`(진행기간·월·`productId`), `Target`(지정처), `TargetCompletion`(완료·`productId`/`productName`).
- 엑셀 파싱: `lib/xlsxReader.ts`(범용 xlsx→행 리더, medExcelImport와 별개로 두어 드리프트 테스트 영향 없음) + `lib/targetExcelImport.ts`(헤더명으로 **의원/병원 포맷 자동 감지**, 컬럼 순서 무관). 매핑 순수 로직은 `targetsFromRows()`로 분리, `tests/targetExcelImport.test.ts`가 검증.
  - 의원: 거래처코드·거래처명·사업부명·팀명·담당자사번·담당자명
  - 병원: 거래처코드·거래처명·**Dr.명**·사업부명·팀명·담당자사번·**담당자명** (담당자명은 헤더가 있으면 병원도 매핑됨)
- **품목(Product)**: 담당자가 로그인 1단계에서 먼저 선택. 캠페인에 `productId`를 지정하면 그 품목 담당자에게만 노출. 관리자 '진행률' 탭 '품목 관리'에서 추가/활성/삭제. 대시보드도 품목별 필터 지원.
- Firestore: `lib/targetsRepo.ts` (컬렉션 `products`/`targetCampaigns`/`targets`/`targetCompletions`, 단일 where 쿼리라 복합 인덱스 불필요, batch는 400개 청크).
- **진행 완료 기준 = 서베이 완료**: `useSessionStore.completeSurvey`가 타겟처 세션(`targetId` 존재)이면 `recordTargetCompletionOnSurvey`로 완료 기록(문서 id `campaignId__targetId`, upsert).
- 로그인: `components/login/TargetLoginPanel.tsx`(품목 선택 → 사번 검색 → 담당자 진행률 바 → 지정처 선택 → `loginWithTarget`). 캠페인·품목은 `useDataStore`로 실시간 구독.
- 관리자: `components/admin/ProgressTab.tsx`(Admin '진행률' 탭) — 품목 관리, 캠페인 CRUD(품목 연결)·진행기간·활성 토글, 의원/병원 엑셀 업로드(교체/추가), **월·품목별** 사업부→팀 진행률 대시보드 + 담당자별 상세 + 엑셀 내보내기.
- **타겟처 개별 관리**: `components/admin/TargetListSection.tsx`(ProgressTab 안의 '타겟처 목록 관리' 섹션) — 캠페인별 조회·검색·사업부/팀 필터, 추가 폼, 행 인라인 수정, 다중 선택 삭제. 문서 id 는 엑셀 업로드와 **동일한 `makeTargetId(campaignId, code, name, drName, empNo)`**(`targetExcelImport.ts`)를 써서, 수동 추가분이 나중에 같은 엑셀에 들어와도 중복 문서가 생기지 않는다. 단 엑셀 '교체' 업로드는 수동 추가분도 지운다(화면에 경고 문구 있음). 식별정보(거래처·Dr.·사번)를 수정하면 id 가 바뀌므로 옛 문서를 지우고 그 타겟처의 완료 기록도 초기화한다.
- 세션 이력(`HistoryTab`): 처방 세션 + **타겟 진행 완료 목록** + 서베이 응답 목록을 화면에 표시. 엑셀 내보내기는 **`lib/historyExport.ts`의 통합 시트 1장**(아래 참조).

#### 이력 엑셀 = 통합 시트 1장 (`lib/historyExport.ts`)

처방·서베이·룰렛·타겟진행을 탭 4개로 나누던 걸 시트 1장으로 합쳤다. `buildUnifiedSheet()`는 순수 함수(`tests/historyExport.test.ts`).

- **행 기준 = 세션 × 환자.** 같은 환자에게 처방을 2번 하면 회차별 2행. 서베이/룰렛은 같은 (세션, 환자)의 같은 순번 행에 붙고 남으면 아래 행으로 흐른다. **서베이만 했으면 처방 칸이 공란인 1행.**
- 사업부·팀·품목·캠페인·거래처코드는 매칭된 `TargetCompletion`에서 오며 그 세션의 모든 행에 반복된다. **'타겟완료일시'는 완료 1건당 딱 한 행에만** 찍는다(중복 합산 방지).
- 완료 ↔ 세션 매칭은 `TargetCompletion.sessionDocId`(optional, 신규 기록부터). **이 필드가 없는 기존 기록은 `사번+거래처명+의사명`으로 폴백 매칭**한다 — 옛 데이터도 그대로 나온다.

### 관리자 카드 편집은 자동 저장 (`components/admin/useDraftAutoSave.tsx`)

허용 조합·삭감 규칙·부작용 면제 탭은 카드마다 로컬 `draft`를 두고 '저장' 버튼을 눌러야 반영되는 구조였다. **체크박스를 켜도 화면만 바뀌고 저장은 안 되는데 표시가 없어서, 설정해뒀다고 믿었지만 실제로는 `classIds: []`였던 사고가 실제로 났다.**

`useDraftAutoSave(draft, onSave)`가 ① 변경 후 800ms 멈추면 자동 저장, ② `SaveStatusBadge`로 상태 표시(변경됨·저장 중·저장됨·실패), ③ **언마운트(카드 접기·탭 이동) 시 미저장분 강제 flush**를 담당한다. ③이 핵심 — 타이머가 끊겨 유실되는 경로를 막는다. 기존 '저장' 버튼은 '지금 저장'으로 남겨 즉시 저장용으로 쓴다.

새 카드 편집 UI를 만들 때도 이 훅을 쓸 것. draft + 수동 저장 버튼만 두는 패턴은 금지.

### 허용 조합은 삭감 규칙보다 상위 (`lib/deductions.ts`)

Admin '허용 조합' 탭(`allowedCombinations`)이 삭감의 최상위 예외다. 처방된 계열 집합이 허용 조합으로 등록돼 있으면 **계열 조합을 근거로 하는 삭감은 전부 면제**된다.

| 구분 | 규칙 | 허용 조합으로 면제? |
|---|---|---|
| 조합 기준 | 관리자 병용 금지 규칙, 내장 DPP-4i+GLP-1, 동일 계열 중복, 급여 N제 초과, 1차 메트포르민 미사용, 병용 요법 1차약제 미포함 | ✅ 면제 |
| HbA1c 기준 | 초기 HbA1c 6.5% 미만, 2제·추가 병용 기준 미달 | ❌ 유지 (조합과 무관) |

- 판정은 `isExempted()` 하나로 통일한다. 병용 금지 규칙은 `규칙 계열 ⊆ 허용조합 A ⊆ 처방 계열`, 조합 기준 나머지(`regimenExempt`)는 '규칙 계열' 자리에 **처방 계열 전체**를 넣어 판정한다 → **허용 조합과 처방 계열 집합이 정확히 일치할 때만** 면제. 넉넉히 등록한 조합 하나가 급여 한도까지 통째로 푸는 걸 막는다.
- ⚠️ **가장 흔한 함정**: 허용 조합에 처방보다 계열이 하나라도 더 있으면 면제가 안 된다. 예로 `[메폴민+SGLT2i+DPP4i+TZD]` 하나로 묶어 등록하면 어떤 처방에도 안 걸린다 — 실제 처방 단위로 따로 등록해야 한다. AllowedTab 화면에 이 내용을 명시해 두었다.
- E11 else-if 체인에서 조합 규칙(2·4번 가지)만 건너뛰어도 안전하다: 2번은 `classCount===1`, 3·4번은 `classCount>=2`로 조건이 배타적이라 아래 가지가 잘못 열리지 않는다.
- 삭감 메시지는 관리자가 자유 입력하므로 **내장 메시지와 같은 텍스트를 등록할 수 있다.** 화면 문구만 보고 내장/관리자 규칙을 구분하지 말 것 — 실제로 이것 때문에 원인 추적이 크게 헤맨 적이 있다.

### 선물 룰렛 확률 (`lib/giftWin.ts`)

확률은 3층이다. 아래로 갈수록 우선한다.

1. **기본 확률** — `Gift.probHospital` / `probClinic`.
2. **캠페인(진행기간)별 확률** — `Gift.campaignProbs?: Record<campaignId, {hospital, clinic}>` (optional). 타겟처 세션의 `campaignId`에 해당 키가 있으면 기본 확률 대신 쓴다. 직접 입력 로그인은 `campaignId=''`라 항상 기본 확률. `giftProb()` / `giftProbs()`가 이 해석을 담당하고, 화면(`GiftsTab`)·집계·룰렛이 전부 이 함수를 거친다.
3. **공병별 총 당첨률 오버라이드** — `resolveComorbWinRate()`. 이건 "당첨이냐 꽝이냐"만 정하고, **어떤 선물이 나올지는 여전히 2층 확률의 비율**로 뽑는다(`pickWinnerWithRate`).

`GiftsTab` 상단의 캠페인 드롭다운은 "어느 캠페인 기준으로 볼지"이며, 합계 100% 초과 검증도 그 기준으로 계산된다. 저장 시 `campaignProbs`가 없으면 `{}`로 채워 넣는다 — Firestore 가 `undefined` 를 거부하기 때문.

### 이미지 업로드(Storage 완전 비의존)

`components/common/ImageUploader.tsx`는 **항상** `lib/imageResize.ts`로 브라우저에서 축소해 **data URL(base64)로 저장**한다(Firebase Storage 미사용 — 버킷·보안규칙·CORS와 무관하게 항상 표시). `maxDim`으로 축소 크기 조절(로고 512·아이콘 256·배경/브로셔 1600). data URL은 Firestore 1MB 문서 한도 아래로 자동 재축소. `storagePath` prop은 하위호환용으로 남아있으나 사용하지 않는다.

### Firestore 경로

```
artifacts/{appId}/public/data/
  patients, medications, medCategories, drugClasses,
  deductionRules, allowedCombinations, sideEffectExemptions,
  surveyQuestions, surveyResponses, gifts, giftLogs,
  products, targetCampaigns, targets, targetCompletions,
  settings/global, rx_sessions/{sessionDocId}
```

`sessionDocId`는 `{병원명}_{의사명}_{타임스탬프}` 형태이며, 세션 키 `{병원명}_{의사명}`로부터 특수문자를 제거해 만든다 (`lib/sessionKey.ts`).

## 도메인 규칙: 자주 헷갈리는 지점

- **약제 effect 부호**: HbA1c는 `effect`만큼 **차감**(양수 = 강하). 체중·LVEF·BNP·NT-proBNP·eGFR·UACR 효과는 부호 그대로 더한다 (음수 = 감소).
- **eGFR = 연간 감소 + 이니셜딥**: 엑셀 모델상 eGFR은 매 처방 `effectEgfr`(연간 감소 기울기, 대개 음수)만큼 항상 감소한다. SGLT-2i/GLP-1은 감소가 완만(−1.5)하지만 **딥 계열에 처음 노출**될 때 `effectEgfrDip`(예: SGLT-2i −4, GLP-1 −1)이 1회 추가된다. 나머지 계열은 딥 없이 −3.5 지속 감소. "처음"의 판정은 **계열 기준**: 이전 복용약(`prevDrugs`)이나 같은 세션 이전 처방에 같은 딥 계열이 있으면 이미 경험한 것으로 보고 딥을 적용하지 않는다. 딥 계열 집합·경험 여부는 `useSessionStore`에서 계산해 `calculatePrescription`에 `dipClassIds`/`experiencedDipClassIds`로 주입한다. → 첫 SGLT-2i 처방 회차는 eGFR이 (연간+딥)만큼 크게 떨어졌다가 이후 완만해지는, 임상적으로 알려진 "초기 딥" 서사를 그대로 보여준다.
- **eGFR/UACR/BNP/NT-proBNP 하한 0**: `optionalNumeric(..., 0)`로 음수 방지(딥·큰 %감소가 저baseline 환자를 음수로 만들지 않도록).
- **결과 리포트 색상**: HbA1c/UACR/체중/BNP/NT-proBNP는 감소가 개선(초록), 증가가 악화(빨강). LVEF/eGFR은 반대 — 증가가 개선. 변동 없는 지표는 표시 생략. 환자가 해당 수치를 가지지 않으면(`0` 또는 `""`) 행 자체를 숨긴다.
- **상병코드 검사 범위**: E11(당뇨) 처방 기준은 슬롯 1~3(보험 처방)의 약물 처방만 대상. 본인부담(슬롯 4~5), `isInsuranceException`, `isNotDrug` 약제는 제외.
- **HbA1c 하한**: `newHba1c = max(4.5, currentHba1c - effect.h)` — 4.5% 이하로 내려가지 않도록 클램프.
- **이전 복용약 누적**: `prevDrugs`는 환자 정의에 들어있는 "초기 내원 시 이력"이고, 같은 시연 세션 내 이전 처방은 `rx_sessions/{id}.prescriptions[]`의 마지막 항목에서 가져온다. 같은 병원+의사 재방문 시 이어받기는 `settings.allowSessionCarryover` 토글로 결정 (기본 false). 산식은 `patientState.ts` 항목 참조 — A안에 따라 재진/리핏은 `prevDrugs` 효과를 차감하지 않는다.

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
