# Dashboard Web 작업 체크리스트

## 환경 설정
- [x] PowerShell ExecutionPolicy=RemoteSigned (CurrentUser) 설정 — 2026-05-20
- [x] `npm run dev` 정상 실행 — 2026-05-20
- [x] http://localhost:3000 로그인 성공 — 2026-05-20

## 사용자 등록 (6-1)
- [ ] 결과 확인 필요 (성공/실패 미확인)

## 기능 구현 (2026-05-20 요청 5건)

### A. 의존성
- [x] `npm install exceljs` (xlsx 생성)

### B. /updater 메뉴 추가
- [x] `.env.local` 에 `GTVS_UPDATER_BAT_DIR=C:\Users\k251110\Desktop\qa-automation` 추가
- [x] `app/api/updater/run/route.ts` — POST { mode: 'once'|'scheduler' }
  - once: child_process.spawn 동기 대기 → stdout/exit_code 반환 + `.runlogs/<ts>_once.json` 저장
  - scheduler: detached spawn → 즉시 PID 반환
- [x] `app/(app)/updater/page.tsx` — 버튼 2개 + 최근 .runlogs 목록 표시
- [x] `app/(app)/updater/updater-controls.tsx` (client component)
- [x] `components/sidebar.tsx` — `/updater` 메뉴 추가

### C. Excel Export (.xlsx, exceljs)
- [x] `lib/exporters.ts` — Records/History 공통 xlsx 빌더
- [x] `app/api/export/records/route.ts` — 필터 query → .xlsx 응답
- [x] `app/api/export/history/route.ts` — 동일
- [x] `app/(app)/records/page.tsx` — "현재 페이지 .xlsx" / "필터 전체 .xlsx" 버튼 추가
- [x] `app/(app)/history/page.tsx` — 동일

### D. Overview 변경
- [x] `lib/queries.ts` — `getLastCheckedAt()` 추가 (update_records 전체 max(checked_at))
- [x] `app/(app)/page.tsx` — 행/열 전치 (rows=packages, cols=devices) + 상단 "Updater 마지막 실행" 배너

### E. 검증
- [x] `npm run build` 통과
- [ ] dev 서버에서 5개 기능 각각 수동 확인 (사용자 확인 필요)
- [x] context-notes.md에 발견된 이슈 누적 (Buffer→Uint8Array→Blob 변환 이슈 1건)

## 추가 요청 (2026-05-20 2차)

### F. 필터 버그 수정
- [x] `records-filters` / `history-filters` 에 `key={params.toString()}` 추가 — URL 변경 시 폼 재마운트

### G. DB 마이그레이션
- [x] `db/migrations/003_extend_devices_packages.sql` 생성
- [x] `scripts/migrate.mjs` 마이그레이션 러너 작성 + 실행 — devices.model, packages.opt_in, packages.rollout_status 컬럼 추가 완료

### H. Settings 인라인 편집
- [x] `app/actions/settings.ts` 에 `updateDeviceModel`, `updatePackageField` 액션 추가
- [x] `components/inline-text-edit.tsx` (blur/Enter 저장)
- [x] `app/(app)/settings/edit-cells.tsx` 래퍼 셀
- [x] Settings 페이지에 model / Opt-In / Rollout Status 컬럼 추가

### I. Overview xlsx + 모델명 입력
- [x] `app/(app)/overview-model-cell.tsx` — Overview 헤더의 모델 인라인 편집
- [x] `lib/exporters.ts` 에 `overviewMatrixToXlsx` 추가
- [x] `app/api/export/overview/route.ts` 신규 + Overview 상단 다운로드 버튼

### J. Records 템플릿 리팩토링
- [x] `lib/template.ts` — buildTemplate(track, filter) → 행=패키지, 단말별 cell map
- [x] `components/filters/records-template-filters.tsx` — track + 패키지 단순 필터
- [x] `app/(app)/records/page.tsx` 전면 재작성 — beta/production 컬럼 분기
- [x] `app/api/export/records/route.ts` — 템플릿 기반 xlsx
- [x] `lib/exporters.ts` 에 `templateToXlsx` 추가
- [x] 사용 안 하게 된 records-filters.tsx, error-cell.tsx 삭제

### K. 검증
- [x] `npm run build` 통과 (15 라우트, 신규: /api/export/overview)
- [ ] dev 서버 재시작 후 수동 확인 (사용자)

## 추가 요청 (2026-05-20 3차) — 이력 초기화 메뉴

### L. History 이력 초기화
- [x] `app/actions/history.ts` 신규 — `clearVersionHistory()` server action (auth + DELETE FROM version_history)
- [x] `lib/queries.ts` — `countAllHistory()` 추가 (필터 무관 전체 카운트)
- [x] `app/(app)/history/clear-history-button.tsx` 신규 — destructive 버튼 + window.confirm
- [x] `app/(app)/history/page.tsx` — 우측 액션 영역에 버튼 추가

### M. Updater 실행 로그 초기화
- [x] `lib/runlogs.ts` — `countRunLogs()`, `clearRunLogs()` 추가
- [x] `app/api/updater/clear-logs/route.ts` 신규 — POST, auth 체크, revalidatePath
- [x] `app/(app)/updater/updater-controls.tsx` — "실행 로그 초기화" destructive 버튼 + window.confirm, totalLogs prop 수신
- [x] `app/(app)/updater/page.tsx` — countRunLogs() 호출하여 prop 전달

### N. 검증
- [x] `npm run build` 통과 (17 라우트, 신규: /api/updater/clear-logs)
- [ ] dev 서버에서 두 버튼 수동 클릭 검증 (사용자)

## 추가 요청 (2026-05-20 4차) — 페이지 속도/동작 최적화

### O. SQLite pragma 튜닝
- [x] `lib/db.ts` — synchronous=NORMAL, temp_store=MEMORY, cache_size=-64000 (64MB), mmap_size=256MB

### P. 인덱스 추가 (마이그레이션 004)
- [x] `db/migrations/004_indexes.sql` 신규 — update_records 4종 / version_history 6종 + analyze
- [x] `node scripts/migrate.mjs ../db/migrations/004_indexes.sql` 적용 완료

### Q. sync_jsonl mtime 캐시 단락
- [x] `lib/sync_jsonl.ts` — fingerprint(size+mtimeMs) 기반 1차 판정. 파일 미변경 시 readFile 자체를 스킵하여 Overview/Records 매 진입 비용 거의 0.

### R. Overview latest 쿼리 SQL-side dedup
- [x] `lib/queries.ts` — `listLatestRecordsForOverview` 내부를 window function (row_number) 으로 교체. 2000건 fetch + JS Map dedup 제거. limit 인자는 backward compat 위해 시그니처 유지(무시).

### S. 검증
- [x] `npm run build` 통과 (17 라우트 동일)
- [ ] dev 서버에서 체감 속도 비교 (사용자)

## 추가 요청 (2026-05-20 5차) — Overview 업데이트 이력 시각화

### T. 이력 있는 패키지명 빨강 표시
- [x] `lib/queries.ts` — `listPackagesWithUpdateHistory()` 추가 (`version_history ∪ update_records(status='updated')` distinct package)
- [x] `app/(app)/page.tsx` — sticky 왼쪽 패키지명 셀에 `bg-red-50` / 텍스트 색상 분기. 단말 데이터 셀의 기존 빨강 로직은 유지.

### U. Updater once 실행 quoting 버그 수정
- [x] `app/api/updater/run/route.ts` — 외부 `chcp 65001` 제거, spawn args 를 `["/c", batName]` 로 단순화 (once / scheduler 양쪽)

### V. 검증
- [x] `npm run build` 통과
- [ ] Overview 에서 이력 있는 패키지 빨강 확인 (사용자)
- [ ] /updater 의 "지금 1회 실행" 정상 동작 재확인 (사용자)

## 추가 요청 (2026-05-21 6차) — 빨강 표시 단말 셀 단위로 통일

### W. Overview 패키지명 빨강 제거 / Records 현재버전 빨강 추가
- [x] `app/(app)/page.tsx` — sticky 왼쪽 패키지명 셀의 `packagesWithHistory` 기반 빨강 분기 제거. 단말 셀의 cell-level 빨강(이전≠현재) 은 그대로 유지.
- [x] `app/(app)/records/page.tsx` — 단말별 "현재버전" td 에 Overview 와 동일한 `bg-red-50` + 텍스트 `bg-red-100 text-red-900` 적용 (`version_before !== version_after` 일 때).
- [x] `lib/queries.ts` — 호출처 사라진 `listPackagesWithUpdateHistory()` 함수 제거 (orphan 정리, CLAUDE.md #3).
- [x] `npm run build` 통과 (17 라우트 동일)
- [ ] dev 서버에서 Overview 패키지명 흰 배경 확인 (사용자)
- [ ] Records 의 업데이트 행에서 현재버전 셀 빨강 확인 (사용자)

## 추가 요청 (2026-05-21 7차) — History/Tests 모델명 표시 + Tests 헤더 슬래시

### X. Tests 페이지 단말 표시를 모델명으로 + 헤더 슬래시 변경
- [x] `app/(app)/tests/page.tsx` — `TestsGrid` 에 `model: d.model` 추가 전달.
- [x] `app/(app)/tests/tests-grid.tsx` — `Device` 인터페이스에 `model: string | null` 추가. 행 라벨을 `model || name` 으로 표시. 헤더 `단말 \ 패키지` → `단말 / 패키지`.

### Y. History 페이지/필터 단말 표시를 모델명으로
- [x] `app/(app)/history/page.tsx` — `listDeviceNames()` → `listAllDevices()` 로 교체. `deviceLabelMap`(name→display) 빌드 후 테이블 `r.device` 표시에 사용. 필터에는 `{name, label}[]` 전달.
- [x] `components/filters/history-filters.tsx` — `devices` props 타입을 `Array<{name, label}>` 으로 변경. dropdown option 의 value 는 name(stb-01) 유지, label 만 모델명 fallback.
- [x] `lib/queries.ts` — orphan 이 된 `listDeviceNames()` 제거 (CLAUDE.md #3).

### Z. 검증
- [x] `npm run build` 통과 (17 라우트 동일)
- [ ] dev 서버에서 Tests 행 라벨이 모델명으로 표시되는지 확인 (사용자)
- [ ] dev 서버에서 History 테이블/필터가 모델명으로 표시되는지 확인 (사용자)
- [ ] Tests 헤더가 `단말 / 패키지` 로 보이는지 확인 (사용자)

## 추가 요청 (2026-05-22 8차) — TEST 대상 시각화 (보고 윈도우 KST 09:00)

배경: 매일 09시 메일 보고 + 보고 대상은 "지난 보고 이후 업데이트된 패키지". 기존 "latest record 의 before≠after" 기준은 후속 up_to_date 가 들어오면 빨강이 사라져 의도에 안 맞음. version_history 의 changed_at 기반으로 윈도우 판정으로 교체.

### AA. 헬퍼 — `lib/time.ts`
- [x] `reportingWindowStartIso(): string` — 가장 최근 KST 09:00 의 naive ISO (`YYYY-MM-DDT09:00:00`). 현재 KST < 09:00 이면 어제 09:00, 아니면 오늘 09:00.

### BB. 쿼리 — `lib/queries.ts`
- [x] `listChangedCellsSinceReport(): Set<string>` — `device::package` 형식. 등록 device·package 한정, `version_history.changed_at >= reportingWindowStartIso()` distinct pair.
- [x] `listChangedPackagesSinceReport(): Set<string>` — 위 결과의 distinct package (TEST 뱃지용).

### CC. Overview (`app/(app)/page.tsx`)
- [x] `updated` 판정을 latest 의 before/after 비교 → `changedCells.has` 로 교체.
- [x] sticky 패키지명 셀 옆 "TEST" 뱃지 (그 패키지가 changedPackages 에 있을 때).
- [x] 배너에 "보고 윈도우" 표시 (`TEST 보고 윈도우 YYYY-MM-DD 09:00:00 ~ · N개 셀`).

### DD. Records (`app/(app)/records/page.tsx`)
- [x] 단말 셀 `updated` 판정 동일하게 교체.
- [x] App Name 셀 옆 "TEST" 뱃지.

### EE. Tests (`app/(app)/tests/page.tsx`, `tests-grid.tsx`)
- [x] 페이지에서 today set 을 grid 에 prop 전달.
- [x] `?only=today` 쿼리 토글 + 카운트 표시.
- [x] only=today 일 때 대상 외 셀은 dim + Run Test disabled (그리드 구조 유지).

### FF. 검증
- [x] `npm run build` 통과 (17 라우트 동일)
- [x] dev 서버 — Overview/Records 빨강이 보고 윈도우 안 변경 셀에 정확히 뜸 (임시 INSERT/DELETE 사이클로 확인, 2026-05-22)
- [x] Tests `?only=today` 토글로 대상만 활성화 (동일 검증에서 확인)

## 추가 요청 (2026-05-22 9차) — 외부 노트북 접속 [보류]

상태: **보류** (2026-05-22). 사용자가 "우선은 같은 네트워크 노트북만 접속, 추가 구현 방식은 추후 고민" 으로 결정.

검토했던 후보 (재논의 시 참고):
- A. 도메인 구입 + Cloudflare Tunnel + Access — $10/년, 고정 URL, OTP 인증. 보안 최고.
- B. Cloudflare Quick Tunnel + NextAuth rate-limit — 비용 0, URL 가변, 코드 ~1h 작업.
- C. 회사 서브도메인(IT 요청) + Cloudflare Tunnel + Access — 비용 0, 승인 의존.

제외 항목 (재논의 시 다시 꺼내지 말 것):
- **Tailscale / mesh VPN 류** — 회사 보안 정책 위반 우려 (사용자 명시).
- ngrok/localtunnel 등 — Cloudflare 외 reverse tunnel 은 회사 화이트리스트 외 가능성.
- 라우터 포트포워딩 — 회사 라우터 제어 불가 + 보안 위험.

기 작성 산출물:
- `scripts/check-tunnel.ps1` — Tunnel 점검 helper. 9차 진행 안 하므로 orphan. 사용자 의견 따라 보존/삭제 결정.

## 추가 요청 (2026-05-22 10차) — Records "이전버전" 오표시 버그 수정

### GG. PerDeviceCell 시그니처 교체
- [x] `lib/template.ts` — `PerDeviceCell` 을 `{previous_version, current_version, status}` 로 재구성. previous_version 은 `version_history` 의 최신 row.version_before, current_version 은 `update_records` 최신 record 의 `version_after ?? version_before`. status 는 그대로.

### HH. 호출처 갱신
- [x] `app/(app)/records/page.tsx` — 셀 필드 접근을 `previous_version` / `current_version` 으로 교체. `version_after ?? version_before` fallback 로직 제거 (template 안으로 이전).
- [x] `lib/exporters.ts` — 동일 갱신. xlsx 의 "이전버전" 컬럼도 같이 고쳐짐.

### II. 검증
- [x] `npm run build` 통과 (17 라우트 동일)
- [x] DB 3개 케이스 직접 비교 — STB-02/vending(production), STB-01/webview·vending(beta) 모두 "이전버전 ≠ 현재버전" 으로 정확히 분리.
- [ ] 사용자 dev 서버 UI 재확인
