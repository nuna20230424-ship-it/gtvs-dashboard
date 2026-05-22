# Dashboard Web 컨텍스트 노트

## 2026-05-20

### ExecutionPolicy 변경
- 명령: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- 사유: PowerShell 기본 정책(Restricted)에서 `npm.ps1`이 차단되어 `npm run dev` 실행 불가.
- 선택 근거: A안(영구, CurrentUser) 채택. Microsoft 공식 권장 정책이며 관리자 권한 불필요. B안(Bypass, Process)은 매번 다시 설정 필요, C안(`npm.cmd` 명시)은 매 명령마다 번거로움.
- 영향 범위: 본인 계정만, 시스템 전체 영향 없음. 로컬 스크립트는 자유, 인터넷 다운로드 스크립트는 서명 필요.
- 검증: `Get-ExecutionPolicy -List` 에서 `CurrentUser = RemoteSigned` 확인.

### 로그인 성공
- 브라우저 http://localhost:3000 접속 후 정상 로그인 완료.

### 주의사항: dev 서버 유지
- `npm run dev`는 **장시간 실행(long-running) 프로세스**. PowerShell 창을 닫거나 Ctrl+C를 누르면 즉시 종료되어 http://localhost:3000 연결 끊김.
- 작업 중에는 해당 PowerShell 창을 **켜둔 상태로 유지**. 브라우저 작업은 별도 창에서.
- 종료할 때만 Ctrl+C. 재시작은 `cd C:\GTVS\dashboard\web` → `npm run dev`.
- 사례(2026-05-20): 로그인 성공 후 창을 닫아 서버가 종료되어 페이지 연결 안 되는 이슈 발생 → 재실행으로 복구.

### 기능 구현 5건 — 설계 결정 (2026-05-20)

**A. bat 실행 메뉴 (`/updater`)**
- 대상 bat 디렉토리: `C:\Users\k251110\Desktop\qa-automation\` (외부 위치 → 환경변수 `GTVS_UPDATER_BAT_DIR`로 분리, 하드코딩 금지)
- `run_gtvs_updater.bat`은 `pip install + 무한 스케줄러 + pause`로 대시보드 호출 시 hang 위험. 그래도 사용자가 "둘 다 가능"을 원하므로 두 모드 모두 노출.
  - `once`: `run_gtvs_updater_once.bat` 호출, 동기 대기, stdout/exit_code 반환
  - `scheduler`: `run_gtvs_updater.bat` 호출, **detached spawn** 후 즉시 PID 반환 (대시보드 hang 회피). 종료는 Task Manager 또는 PID kill — v1에서는 stop 버튼 미제공.
- 실행 로그 저장: DB 스키마(`gtvs.db`)는 Python updater가 외부 관리하므로 새 테이블 추가 회피. 대신 파일 기반 `.runlogs/<timestamp>_<mode>.json`. 추후 빈도/검색 요구가 생기면 DB로 이관.
- 동시 실행 방지: v1에서는 미구현 (KISS). 운영자가 더블 클릭 안 하는 것으로 충분.

**B. Excel Export — `.xlsx` (exceljs)**
- CSV 대신 .xlsx 선택 이유: 한글 BOM/구분자 이슈가 사라지고 컬럼 스타일 적용 가능. exceljs는 streaming-friendly.
- 범위: "현재 페이지" + "필터 전체" 버튼 2개. 페이지네이션 무시한 전체는 잠재적으로 수만 건 → 응답 stream으로 처리.
- 엔드포인트: `/api/export/records?<filters>` , `/api/export/history?<filters>` GET. query에 `scope=page` 또는 미지정시 filter 전체.

**C. Overview 행/열 전치**
- 기존: rows=devices, cols=packages. 단말이 적고 패키지가 많아 가독성 나빴음.
- 변경: rows=packages, cols=devices. 한 패키지의 단말별 버전 비교가 주된 사용 패턴이라는 사용자 의도 반영.
- sticky left 컬럼은 패키지명, sticky top header는 단말명.

**D. Overview 상단 배너 — "Updater 마지막 실행 시각"**
- 정의: `update_records` 테이블 전체에서 `max(checked_at)`. 즉 어떤 단말/패키지든 가장 최근 체크 시각.
- 단말별 마지막 시각이 아닌 전역 1개 — 사용자가 "전체적으로 데이터가 얼마나 신선한가"를 한눈에 보고 싶을 때 유용.

### 주의사항: dev 서버 유지
- `npm run dev`는 **장시간 실행(long-running) 프로세스**. PowerShell 창을 닫거나 Ctrl+C를 누르면 즉시 종료되어 http://localhost:3000 연결 끊김.
- 작업 중에는 해당 PowerShell 창을 **켜둔 상태로 유지**. 브라우저 작업은 별도 창에서.
- 종료할 때만 Ctrl+C. 재시작은 `cd C:\GTVS\dashboard\web` → `npm run dev`.
- 사례(2026-05-20): 로그인 성공 후 창을 닫아 서버가 종료되어 페이지 연결 안 되는 이슈 발생 → 재실행으로 복구.

### 빌드 이슈 — Buffer/Uint8Array → NextResponse BodyInit (2026-05-20 해결)
- exceljs `writeBuffer()` 결과를 `new NextResponse(buf, ...)`에 직접 넘기면 TS5 strict 환경에서 `Buffer<ArrayBufferLike>` / `Uint8Array<ArrayBufferLike>`가 `BodyInit`에 호환되지 않는다고 에러 발생.
- 해결: `lib/exporters.ts`는 `Uint8Array` 반환으로 통일. API route에서는 `new Blob([buf as BlobPart], { type: ... })`로 감싸 NextResponse에 전달. Content-Type은 Blob에서 자동 설정.

### 미해결
- 6-1 사용자 등록 결과 미확인 — 다음 세션에서 사용자에게 확인 필요.
- dev 서버에서 5개 신규 기능 수동 검증 미완료 (사용자 확인 단계).

## 2차 작업 — 2026-05-20

### 필터 버그 — root cause
- `<Select defaultValue=...>`는 마운트 시 1회만 적용. URL이 바뀌어도 컴포넌트가 보존되므로 dropdown은 옛 값 유지 → "필터가 안 먹는다"고 느낌.
- 수정: 폼 element에 `key={params.toString()}` 부여 → URL 변경 시 폼 통째로 remount → defaultValue 새 params 반영.

### DB 마이그레이션
- 003_extend_devices_packages.sql: devices.model TEXT, packages.opt_in TEXT, packages.rollout_status TEXT.
- Python updater (init_snapshot/main/updater/reporter.py)에 INSERT 구문 없음을 확인. ALTER TABLE ADD COLUMN 안전.
- 마이그레이션 적용기 scripts/migrate.mjs: dotenv 의존 회피용 .env.local 직접 파싱. SQL 문장은 라인 단위 주석 스트립 후 `;` 단위 분할 (첫 명령이 주석 뒤에 있으면 startsWith("--") 필터에 걸려 누락되는 버그 한 차례 발생 → 라인 사전 정리로 해결).

### Records 템플릿 설계 결정
- 기존 Records (per-record, 페이지네이션) → 신규 Records (per-package, point-in-time)로 **대체**. 기존 페이지네이션/날짜 필터 제거.
- track 필터 기본 `beta`. URL `?track=production` 으로 전환.
- "Latest version" = `update_records` 중 (package, track) 의 최근 `version_after`. "Last update" = `version_history` 중 (package, track) 의 최근 `changed_at`. "Age (days)" = `floor((now - last_update) / 86400000)`.
- 단말별 (이전버전, 현재버전, 상태) 3개 sub-column 자동 확장. 단말 N대면 컬럼 7+3N 또는 6+3N (track별).
- 이전/현재/상태는 해당 (device, package, track) 의 최신 update_records.

### 인라인 편집 패턴
- `components/inline-text-edit.tsx` — blur/Enter 저장, ESC 취소, 빈 문자열 → NULL.
- 서버 액션은 client 측에서 직접 import 호출 (Next.js Server Action). 단, server action 자체에 추가 인자(id, field)가 필요한 경우 client wrapper(`edit-cells.tsx`, `overview-model-cell.tsx`)로 클로저 binding.

### 정리
- 삭제: `components/filters/records-filters.tsx`, `app/(app)/records/error-cell.tsx` (template 전환으로 orphan).
- 유지: `lib/queries.ts`의 `listRecords`, `listAllRecords` — 사전 존재(`listRecords`) + 내가 추가했지만 향후 재사용 여지(`listAllRecords`). 굳이 제거하지 않음.

## 3차 작업 — 이력 초기화 메뉴 (2026-05-20)

### 요청
"history, updater 모두 이력 초기화 메뉴 추가" — `/history` 와 `/updater` 각 페이지에 "이력 초기화" 버튼 추가.

### 범위 결정 (사용자 확인)
- **History**: `version_history` 테이블 전체 삭제. `update_records`/`version_snapshot` 은 건드리지 않음 — Overview/Records 데이터 보존, manual 변경 감지 기준점 유지.
- **Updater**: `.runlogs` 디렉토리 전체 삭제. JSONL 원본은 유지 — Python updater 의 데이터 흐름 침범 회피.
- **확인 다이얼로그**: `window.confirm` + 삭제 건수 표시. 실수 방지 + 코드 단순.

### 구현 패턴 선택
- History 측은 **server action** (`app/actions/history.ts`) — 기존 settings 패턴과 일치, 별도 API route 불필요.
- Updater 측은 **API route** (`app/api/updater/clear-logs/route.ts`) — 기존 `/api/updater/run`, `/api/updater/sync` 와 일치, 영역 일관성 우선.
- 두 패턴이 섞이는 이유: 각 페이지가 이미 자기 영역에서 채택한 mutation 패턴을 따랐기 때문. 일관성을 페이지 내부에서 우선시.

### 버튼 라벨에 건수 노출
- `이력 초기화 (1,234건)` 형식. count 가 0 이면 `disabled`. 사용자가 "지울 것이 있는지" 클릭 전 인지하도록.
- count 는 server component 에서 미리 쿼리(`countAllHistory`, `countRunLogs`) 해 client 컴포넌트에 prop 전달.

### detached 스케줄러 영향 없음
- `.runlogs` 삭제는 파일만 지울 뿐 detached 로 띄운 백그라운드 `python main.py` 프로세스에는 영향 없음. 그 프로세스가 다음 실행 결과를 새 파일로 다시 기록.
- 단, 현재 실행 중인 `once` 가 아직 stdout 을 모으는 중에 그 파일이 사라지면 `appendRunLog` 가 `writeFileSync` 로 다시 쓰므로 무해. race 우려 없음 (write 는 sync, clear 는 unlink — 마지막 write 가 이김).

## 4차 작업 — 페이지 속도/동작 최적화 (2026-05-20)

### 진단된 4대 병목
1. **매 페이지 진입마다 `syncFromJsonl()` 전체 read** — `force-dynamic` Overview/Records 가 매 요청마다 전체 JSONL 을 readFileSync + split. 처리 완료된 라인까지 매번 메모리 적재.
2. **`listLatestRecordsForOverview(2000)` full scan + JS Map dedup** — 누적 데이터 증가에 정비례 비용. 인덱스 없는 정렬.
3. **인덱스 0 개** — `update_records`/`version_history` 의 핫컬럼(`checked_at`, `device`, `package`, `track`, `source`) 무인덱스.
4. **SQLite pragma 미튜닝** — WAL 만 활성. synchronous=FULL, cache 기본값(2MB), mmap 미사용.

### 조치
- **pragma** (`lib/db.ts`): `synchronous=NORMAL` (WAL 환경에서 안전), `temp_store=MEMORY`, `cache_size=-64000` (64MB 페이지 캐시), `mmap_size=256MB`. read-heavy 워크로드에 효과.
- **인덱스** (`db/migrations/004_indexes.sql`):
  - `update_records (device, package, checked_at desc)` — Overview/Records 단말×패키지 최신 조회 핵심.
  - `update_records (package, track, checked_at desc)` — Records 템플릿 latest_version.
  - `update_records (device, package, track, checked_at desc)` — Records 단말 셀.
  - `update_records (checked_at desc)` — Overview 배너 max(checked_at).
  - `version_history (changed_at desc)` — History 페이지 정렬.
  - `version_history (package, track, changed_at desc)` — Records 템플릿 last_update.
  - `version_history (track / device / package / source)` 단일 컬럼 보조 — 필터 단독 적용 케이스.
  - 끝에 `analyze` 로 통계 갱신.
- **sync_jsonl mtime 캐시** (`lib/sync_jsonl.ts`): 파일 `size + mtimeMs` 를 state 에 저장. 다음 호출에서 동일하면 `readFile` 자체를 스킵 (라인 카운트조차 안 셈). Updater 가 아무것도 안 쓰면 page 진입 비용 ~0.
- **Overview latest SQL dedup** (`lib/queries.ts`): `row_number() over (partition by device, package order by checked_at desc) = 1` 으로 단말×패키지 수만큼만 반환. JS Map dedup 제거. `idx_update_records_dev_pkg_time` 가 partition+order 둘 다 만족.

### 호환성 / 위험
- `listLatestRecordsForOverview(limit)` 시그니처 유지 (`_limit` 으로 무시). 호출처 2 곳 (`app/(app)/page.tsx`, `app/api/export/overview/route.ts`) 변경 불필요. test (`scripts/run_tcs.mjs`)는 함수 import 없이 SQL 직접 검증이라 영향 없음.
- 마이그레이션 004 는 모두 `if not exists` — 재실행 안전. `analyze` 도 idempotent.
- pragma 는 connection 단위라 globalThis 캐시된 conn 에 1회만 적용됨. dev hot reload 시 globalThis 가 재사용되므로 pragma 누락 위험 없음.

## Updater once 모드 실행 실패 — quoting 버그 (2026-05-20)

### 증상
- 대시보드 `/updater` 의 "지금 1회 실행 (once)" 클릭 시 exit code 1, stdout 에
  `'"run_gtvs_updater_once.bat"'은(는) 내부 또는 외부 명령... 이 아닙니다` (cp949 깨진 형태).

### Root cause
- `app/api/updater/run/route.ts` 가 `spawn("cmd.exe", ["/c", `chcp 65001>nul & call "${batName}"`], ...)` 형태로 호출.
- Node Windows 의 args escape 규칙이 args[1] 안의 `"` 를 `\"` 로 escape → cmd 가 받은 문자열에 `\"` 가 그대로 남음.
- cmd 는 `\` 를 escape 문자로 인식하지 않으므로 `\"run_gtvs_updater_once.bat\"` 전체를 파일명으로 해석 → 실행 실패.

### 수정
- 외부 `chcp 65001 > nul` 호출 제거. bat 파일들이 첫 줄에서 이미 동일 명령을 수행함.
- spawn args 를 `["/c", batName]` 로 단순화. batName 은 공백 없는 ASCII 라 escape 영향 없음.
- 동일한 패치를 once / scheduler 양쪽에 적용 (scheduler 도 같은 quoting 버그를 갖고 있었지만 `stdio: "ignore"` 라 사용자가 인지 못 함).

### Files
- `app/api/updater/run/route.ts` — cmdLine 변수 제거, spawn 두 호출 모두 직접 batName 전달.

## Overview — 업데이트 이력 있는 패키지 빨강 표시 (2026-05-20)

### 요구
"overview 에서 업데이트 이력이 있는 패키지는 records 를 참고해서 빨간색으로 표기".

### 정의 (사용자 확인)
- "업데이트 이력 있음" = `version_history` 에 등장 OR `update_records.status='updated'` 인 행 존재. 둘 중 하나라도 충족하면 빨강.
- 빨강 범위 = sticky 왼쪽 패키지명 셀만 (앱 이름 + package 두 줄). 단말 데이터 셀의 기존 cell-level 빨강(latest record 의 before/after 차이) 로직은 그대로 유지.
- 두 시각이 보완 관계: 왼쪽 셀 빨강 = "이 패키지는 과거 어느 시점에 업데이트된 적 있음" (영구), 데이터 셀 빨강 = "가장 최근 체크가 실제 업데이트 이벤트였음" (latest 만).

### 구현
- `lib/queries.ts` 에 `listPackagesWithUpdateHistory(): string[]` 추가. 단일 union 쿼리로 distinct package 리스트 한 번에 조회. 인덱스(`idx_version_history_package`, `idx_update_records_pkg_track_time`) 가 양쪽 분기를 커버.
- 페이지 서버 컴포넌트에서 `Set` 으로 변환 후 packageList 렌더 시 O(1) lookup. force-dynamic 환경이라 진입 시점 항상 최신 반영.

## 6차 작업 — 빨강 표시 단말 셀 단위로 통일 (2026-05-21)

### 요구
1. Overview 의 패키지명 셀 빨강(이력 기반, broad) 을 제거. 단말 셀의 "이전버전≠현재버전" 빨강만 남겨 시각적 노이즈 축소.
2. Records 의 "현재버전" 컬럼에도 동일 기준으로 빨강 음영 추가 — 두 페이지가 같은 신호로 같은 시각을 사용하도록 통일.

### 설계 결정 (사용자 확인)
- **Overview 패키지명 셀 빨강 제거**: 5차 작업에서 도입한 `listPackagesWithUpdateHistory()` 기반 broad 빨강은 "한 번이라도 업데이트된 적 있음" 이라 신호 가치가 빠르게 saturating. 단말 셀의 cell-level 빨강만으로 "지금 시점에 무엇이 갱신 중인가" 가 충분히 보임.
- **Records 빨강 스타일은 Overview 와 동일**: `bg-red-50` (셀 배경) + 텍스트 `bg-red-100 text-red-900` (rounded chip). 사용자가 Overview ↔ Records 를 오가며 같은 의미는 같은 시각으로 인지하도록.
- **'이전버전' 셀은 빨강 미적용**: 강조 대상은 "지금 설치되어 있는 버전" 이지 과거값이 아님. 사용자 요청에도 "업데이트 된 버전(현재버전)" 으로 명시됨.

### 구현
- `app/(app)/page.tsx` — `packagesWithHistory` Set / `listPackagesWithUpdateHistory` import / sticky 셀의 `hasHistory` 삼항 모두 제거. tr map 도 explicit return → implicit return arrow 로 단순화.
- `app/(app)/records/page.tsx` — 단말 루프 안에서 Overview 와 동일한 `updated` 판정 (`version_before != null && version_after != null && version_before !== version_after`). 현재버전 td 에만 적용, 이전버전/상태 td 는 손대지 않음.
- `lib/queries.ts` — `listPackagesWithUpdateHistory()` 함수 자체 삭제 (호출처 사라져 orphan). CLAUDE.md #3 "내 변경이 만든 orphan 은 제거" 적용. 인덱스(idx_version_history_package, idx_update_records_pkg_track_time) 는 다른 쿼리에서 계속 사용하므로 그대로 둠.

### 호환성
- 17 라우트 동일, 신규 엔드포인트 없음. `npm run build` 통과.
- Overview 데이터 셀 빨강 로직 변경 없음 — 5차 작업 이전 상태 + 5차의 패키지명 빨강 제거 형태.

## 7차 작업 — History/Tests 모델명 표시 + Tests 헤더 슬래시 (2026-05-21)

### 요구
1. History, Tests 페이지에서 `stb-01`/`stb-02` 같은 device name 대신 Overview 에서 사용자가 입력한 model 명을 표시. 없으면 device name 으로 fallback (Overview/Records 와 동일 규칙).
2. Tests 의 좌상단 헤더 `단말 \ 패키지` → `단말 / 패키지`.

### 설계 결정
- **device name 은 underlying key 로 유지**: `version_history.device`/필터 query param 모두 stb-01 등 name 으로 저장/조회. 표시 라벨만 model fallback. 데이터 마이그레이션 불필요, URL 호환성 유지.
- **History 필터 dropdown 도 라벨 교체**: 사용자가 "stb-01" 으로는 단말을 식별 못 하므로 일관성을 위해 dropdown 도 모델명 표시. value 는 name 으로 유지해 query/검색 영향 0.
- **device label 빌드는 페이지 server component 한 곳에**: `Map<string, string>` (name→label) 을 페이지에서 1회 생성, 테이블 렌더 시 O(1) 조회. 필터 컴포넌트에는 `{name, label}[]` 로 압축 전달.
- **Records / Overview 는 손대지 않음**: 이미 inline `d.model && d.model.trim() !== "" ? d.model : d.name` 패턴 적용 완료 (5차 이전부터). 일관성 그대로.

### 구현
- `app/(app)/tests/page.tsx` — `TestsGrid` props 에 `model: d.model` 추가.
- `app/(app)/tests/tests-grid.tsx` — `Device.model: string | null` 추가, 행 라벨에 fallback 적용, 헤더 문자열 변경.
- `app/(app)/history/page.tsx` — `listDeviceNames()` 호출 제거하고 `listAllDevices()` 사용. `deviceLabelMap`/`deviceOptions` 두 derived 값을 만들어 각각 테이블/필터에서 사용.
- `components/filters/history-filters.tsx` — props 타입을 `Array<{name, label}>` 로. option value=name, 텍스트=label.
- `lib/queries.ts` — `listDeviceNames()` 호출처 사라져 삭제 (orphan).

### 호환성
- 17 라우트 동일. URL query (`?device=stb-01`) 의미 변동 없음. 모델명이 미설정인 단말은 기존대로 stb-01 표시.

## 8차 작업 — TEST 대상 시각화 (보고 윈도우 KST 09:00) (2026-05-22)

### 배경 — 기존 빨강의 한계
- 6차 작업에서 도입한 빨강 판정 `version_before != version_after` 는 **latest record 1건**만 본다.
- Python updater 가 업데이트 후 다시 돌면 latest 가 `up_to_date` (또는 before=after) 가 되며 빨강 사라짐 → 사용자가 매일 09시 메일 보고로 TEST 대상을 식별하는 워크플로에서 "오늘 변경된 패키지" 가 시각적으로 묻힘.

### 정책 결정 (사용자 확인)
- **신호 출처**: `version_history` 의 `changed_at` (변경 이벤트 영구 적재. latest 의존도 제거).
- **윈도우 단위**: KST 09:00 기반 daily window. 매일 09시 메일 보고와 정렬.
  - 현재 KST ≥ 09:00 → 오늘 09:00 ~ 현재
  - 현재 KST < 09:00 → 어제 09:00 ~ 현재 (윈도우 길이 ~24h, 새벽 시점에도 직전 영업일 변경이 살아있도록)
- **A+C**: 단말 셀 빨강(셀 단위) + 패키지명 옆 "TEST" 뱃지(행 요약). Overview/Records 동시 적용.
- **Tests 동선**: `?only=today` 쿼리로 토글. 켜지면 변경 (device, package) 셀의 Run Test 만 활성, 나머지 dim+disabled. 그리드 구조는 유지.

### timestamp 가정 — KST naive ISO
- `version_history.changed_at` 샘플(`2026-05-22T08:05:46`) + 현재 시각 (UTC 0:16, KST 9:16) 비교로 약 1시간 전 작성된 row 임을 확인 → **Python updater 가 사용자 PC 의 로컬 시각(KST) 을 timezone suffix 없이 적재**.
- 비교는 동일 포맷 naive string lex compare 로 충분 (ISO 8601 lexicographic ordering). SQLite text 비교 OK.
- 만약 Python updater 측이 UTC 로 바뀌면 `lib/time.ts` 헬퍼 한 줄만 교체. queries/페이지는 영향 없음.

### 부작용 / 격리
- 기존 latest 표시(현재버전·이전버전·상태·시각)는 그대로. **판정 입력만** today set 으로 교체.
- 기존 chip 스타일(`bg-red-100 text-red-900`) 그대로 재사용 → 시각 일관성 유지.
- track 무관 (셀이 오늘 바뀌었나만 봄) → Records `?track=production` 에서도 동일 신호.
- source='manual' 도 포함 — 수동 변경이라도 TEST 대상에 들어가는 게 사용자 의도와 일치.

### Tests `?only=today` 결정 근거
- URL 쿼리 선택 이유: server component 라 SSR 친화 + URL 공유로 메일 본문에 `https://.../tests?only=today` 링크 첨부 가능. 클라이언트 토글(useState) 보다 운영 워크플로에 유리.
- 그리드 구조 유지 + dim 처리 이유: 단말×패키지 위치 파악이 자동화 스크립트 연결 작업 시 도움. 셀이 사라지면 어디서 클릭할지 헷갈림.

## 운영 자동화 — Task Scheduler 자동시작 (2026-05-22)

### 요구
"npm run dev 를 별도로 띄우지 않고 http://localhost:3000 접속만으로 dashboard 가 응답하게" — 사용자 PC 부팅/로그인 시 production server 가 자동 기동.

### 결정 (사용자 확인)
- **모드**: production (`npm run start`). `npm run build` 산출물을 띄우는 next start. dev (HMR) 대비 안정·경량.
- **자동시작**: Windows Task Scheduler 의 `AtLogon` 트리거. NSSM/pm2 같은 추가 도구 없음. 콘솔 창은 vbs 래퍼로 hidden.
- **dev 전환**: helper script 2개로 production Task disable + 포트 정리 → 평소처럼 `npm run dev` → 끝나면 helper 로 복귀.

### 파일 구성
- `scripts/start-prod.bat` — 실제 `npm.cmd run start` 실행. stdout/err 를 `.runlogs/server.log` 에 append.
- `scripts/start-prod.vbs` — bat 을 `WshShell.Run "..., 0, False"` 로 hidden 백그라운드 호출. Task 가 가리키는 진입점.
- `scripts/switch-to-prod.ps1` — 포트 3000 점유 process kill → Enable+Start Task → 5s 후 LISTEN/log tail 보고.
- `scripts/switch-to-dev.ps1` — Disable Task → 포트 3000 점유 process kill → 안내 출력.

### Task 등록 명령 (한 번만)
```powershell
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '"C:\GTVS\dashboard\web\scripts\start-prod.vbs"'
$trigger = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName 'GTVS Dashboard' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'GTVS Dashboard production server (next start) at user logon'
```

### 설계 근거
- **vbs hidden 래퍼**: Task 의 "Hidden" 옵션은 콘솔 창이 짧게 깜빡일 수 있어 vbs `WshShell.Run(..., 0, False)` 가 진짜 invisible. cmd 콘솔이 끝까지 안 보임.
- **npm.cmd** 직접 호출: PowerShell `.ps1` 경유 안 함 → ExecutionPolicy 무관. cmd /c 로 단순.
- **ExecutionTimeLimit 0**: Task Scheduler 기본 72h 제한 해제. 무제한 서버.
- **RestartCount 3**: Task 자체 실패 시 1분 간격 3회. server 가 EADDRINUSE 등으로 실패하면 회복 시도. (process 가 hang 한 경우는 못 잡음 — 필요해지면 pm2 로 이관)
- **LogonType Interactive**: 사용자 로그인 세션의 환경변수·PATH 상속. `.env.local`, npm PATH 가 자동 적용.

### dev 전환 흐름
1. `powershell -File C:\GTVS\dashboard\web\scripts\switch-to-dev.ps1` — Task disable + port kill
2. `npm run dev` (평소대로)
3. 작업 끝, Ctrl+C
4. `powershell -File C:\GTVS\dashboard\web\scripts\switch-to-prod.ps1` — Task enable + start + LISTEN 확인
5. 코드 변경 시 dev 모드에서 검증 → switch-to-prod 호출 전에 `npm run build` 한 번 (production 산출물 갱신)

### 위험·격리
- 두 helper 모두 LocalPort 3000 점유 process 만 죽임 — 다른 process 영향 없음.
- Task 는 사용자 계정 권한, 관리자 권한 불필요. 다른 사용자 환경에 영향 0.
- `.runlogs/server.log` append 형식 — 누적 시 사용자가 가끔 truncate.

### 운영 안전망 추가 (2026-05-22)
- `next dev` 가 한 번 돌면 `.next/BUILD_ID` 가 사라져 `next start` 가 "Could not find a production build" 로 즉사. 사용자가 dev→prod 전환 시 매번 `npm run build` 를 손으로 기억해야 하는 부담.
- 해결: `switch-to-prod.ps1` 의 step 2 에서 `.next/BUILD_ID` 존재를 검사. 없으면 `npm run build` 자동 실행 후 결과 검증. 있으면 skip → 평소엔 빠르게 재시작.
- 이걸 helper 안에 둔 이유: 매번 build 하면 ~30s 대기 비용. BUILD_ID 검사만으로 코드 변경 후/dev 직후 케이스를 충분히 잡음. 코드 변경 후 build 안 하고 stale BUILD_ID 가 남아있는 케이스는 사용자 책임 (수동 `npm run build`).
- Register-ScheduledTask `-UserId` 는 fully-qualified (`DOMAIN\username`) 필요. 5.1 환경에서 bare username 은 거부됨. `install-task.ps1` 에서 `$env:USERDOMAIN\$env:USERNAME` 사용.
- 콘솔 한국어 출력 깨짐 (cp949 vs UTF-8 no-BOM) — 세 helper 모두 Write-Host 메시지는 영문, 주석만 한국어 유지.

## 외부 네트워크 접속 — 보류 결정 (2026-05-22)

요구가 한 차례 "다른 네트워크 노트북도 접속" 으로 확장됐다가 사용자 결정으로 **LAN-only 로 회귀**. 추가 구현 방식은 사용자 추후 재논의.

### 보류 사유
1. **도메인 비용**: $10/년 결제·관리 부담에 사용자 소극.
2. **Tailscale 류 OUT**: 회사 보안 정책상 mesh VPN/P2P 도구는 위반 우려. 사용자 명시.
3. **무료 경로의 trade-off**: Cloudflare Quick Tunnel 은 URL 가변 + Access 못 씀 → 매번 URL 공유 부담 + NextAuth 단독 의존. 코드 강화 (rate-limit/lockout) 도 작업량.
4. 결과적으로 즉시 진행할 단일 정답이 없어 보류가 합리적 판단.

### 재논의 시 출발점
- 후보: A 도메인 구입 + Cloudflare Tunnel + Access (최선) / B Quick Tunnel + NextAuth 강화 (무료) / C 회사 서브도메인 IT 요청 (무료 + 보안).
- 제외 영구 확정: Tailscale·ZeroTier 류 mesh VPN, 라우터 포트포워딩.
- 재논의 트리거: 도메인 결제 가능해짐 / IT 가 서브도메인 승인 / 외부 접속 빈도 증가로 필요성 명확화.
- 기 작성 helper `scripts/check-tunnel.ps1` — 9차 진행 안 하므로 orphan 상태. 재논의 전까지 보존 여부는 사용자 의견 따름.

### 현재 운영 베이스
- LAN 내부 (172.30.1.x) 의 노트북만 `http://172.30.1.44:3000` 으로 접속.
- 외부 노트북·휴대전화에서 접속할 수단 없음. 외출 중 확인 불가.
- 보안 측면 안정 (회사 LAN 격리 + NextAuth + Firewall Domain+Private 만 허용).
