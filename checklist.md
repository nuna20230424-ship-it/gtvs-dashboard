# GTVS Dashboard - 체크리스트

## 셋업
- [x] 프로젝트 디렉토리 생성
- [x] 계획 문서 작성 (`docs/plan.md`)
- [x] context-notes 초안
- [ ] Supabase 프로젝트 생성 (사용자 작업)
- [ ] `.env.local` / `.env` 작성

## Agent A — Backend (Supabase)
- [ ] `supabase/migrations/001_init.sql` - 테이블 4개 생성
- [ ] RLS 정책: authenticated 읽기 / service_role 쓰기
- [ ] 인덱스: `update_records(checked_at DESC)`, `version_history(changed_at DESC)`
- [ ] 시드 데이터 (devices, packages from config.yaml)
- [ ] `supabase/README.md` - 적용 방법

## Agent B — Frontend (Next.js)
- [ ] `web/` Next.js 14 + Tailwind + shadcn/ui 셋업
- [ ] Supabase 클라이언트 (`@supabase/ssr`)
- [ ] Email/Password 로그인 페이지
- [ ] 미들웨어로 보호 라우트
- [ ] 사이드바: Overview / Records / History / Tests / Settings
- [ ] Records 페이지: 테이블 + 필터(track/device/package/status/date)
- [ ] History 페이지: 테이블 + 필터
- [ ] Overview 페이지: 최신 스냅샷 매트릭스
- [ ] Tests 페이지: 패키지×단말 그리드 + "Run Test" 버튼 (placeholder)
- [ ] Settings 페이지: devices/packages 표시
- [ ] `web/README.md` - 실행 방법

## Agent C — Integration
- [ ] `integration/supabase_sink.py` - REST POST 래퍼
- [ ] `gtvs_updater/main.py` 패치 가이드 (또는 patch 파일)
- [ ] 실패 시 `pending_upload.jsonl` 큐
- [ ] dry-run 스크립트
- [ ] `integration/README.md` - 통합 방법

## 통합 & 자체 테스트
- [x] Next.js `npx next build` 성공 (10개 라우트, type-check 통과)
- [x] Next.js Supabase ssr 콜백 타입 에러 수정 (CookieToSet 타입 명시)
- [x] Python `python dry_run.py --records N --history N` 동작 확인 (credentials 없을 때 큐로 폴백)
- [x] Python `python dry_run.py --flush` 동작 확인 (큐 유지)
- [~] ~~Supabase 프로젝트 생성~~ — **B안(Mac mini Postgres)로 전환되어 폐기**
- [~] ~~`.env.local`, `integration/.env`(Supabase용)~~ — **재작성 예정**

---

## ~~B안 전환 (2026-05-19 오후 결정 — Mac mini Postgres + Tailscale)~~ **폐기**

Tailscale 설치 자체가 보안 이슈로 판단되어 폐기. `context-notes.md` 2026-05-19 (저녁) 섹션 참조.
관련 산출물 `docs/macmini-setup.md`, `db/migrations/postgres/001_init.sql` 은 참조용으로 아카이브에 보존.

---

## 노트북 단독 전환 (2026-05-19 저녁 결정 — SQLite 단일 노트북)

`context-notes.md` 2026-05-19 (저녁) 섹션 참조. 본인만 사용, localhost only, Google Drive 백업.

### Phase 1 — 결정 문서 정리 + 폐기 자산 정리 (완료)
- [x] `context-notes.md` 2026-05-19(저녁) 섹션 추가
- [x] `checklist.md` 본 섹션 추가
- [x] `docs/macmini-setup.md` → `docs/archive/macmini-setup.md`로 이동 + 상단 "폐기" 안내
- [x] `db/migrations/001_init.sql` (Postgres) → `db/migrations/postgres/001_init.sql`로 이동

### Phase 2 — SQLite 스키마 + 노트북 셋업 가이드 (완료)
- [x] `db/migrations/001_init.sql` 신규 — SQLite 호환판 (WAL pragma 포함, `users` 테이블 포함)
- [x] `db/migrations/002_seed.sql` SQLite 호환 변환 (`public.` prefix 제거 — 검증 중 발견)
- [x] `docs/laptop-setup.md` 신규 — 노트북 셋업 가이드 (Phase 2 범위)
- [x] **사전 검증 (옵션 C)** — `gtvs.db` 실제 생성 + 통합 검증 명령 동작 확인 완료
- [x] 가이드 3·4단계를 통합 검증 명령 1개로 단순화 (`sqlite_sequence` 필터 포함)

### Phase 3 — Next.js 전환 (Supabase 제거 → SQLite + NextAuth) (완료)
- [x] `package.json` 의존성 교체 (`@supabase/*` 제거, `better-sqlite3@^12`, `next-auth@5.0.0-beta.25`, `bcryptjs@^2.4.3` + types)
- [x] `lib/db.ts` 신규 — `better-sqlite3` 싱글톤, WAL/foreign_keys 보장, globalThis 캐시(HMR 안전)
- [x] **`auth.config.ts` 신규 — edge-safe 기본 설정** (middleware 호환 위해 분리, 처음 계획에 없던 추가)
- [x] `auth.ts` — NextAuth v5 Credentials Provider (users 테이블 + bcrypt 검증)
- [x] `app/api/auth/[...nextauth]/route.ts` — handlers 분해 export
- [x] ~~조회용 API Route~~ — **B안(서버 컴포넌트 직접 DB 호출)으로 결정되어 미작성**. `lib/queries.ts` + `lib/filters.ts` 로 대체
- [x] `lib/queries.ts` 신규 — devices/packages/records/history/overview 쿼리 함수
- [x] `lib/filters.ts` 신규 — URL searchParams → 필터/페이지네이션 (API Route 전환 대비 분리)
- [x] `app/actions/settings.ts` 신규 — active 토글 server action
- [x] `middleware.ts` — NextAuth(authConfig) 로 교체 (edge runtime safe)
- [x] 로그인 페이지 — NextAuth signIn 기반 server action, 한국어 에러 메시지
- [x] 각 페이지(Overview/Records/History/Settings/Tests) `lib/queries` 직접 호출로 교체
- [x] `app/(app)/settings/active-toggle.tsx` — `toggleActive` server action 호출
- [x] `lib/supabase/` 삭제, `supabase/` → `docs/archive/supabase/` 이동
- [x] `.env.local` 신규 — `DB_PATH`, `AUTH_SECRET` (32B 랜덤), `AUTH_URL`, `AUTH_TRUST_HOST`
- [x] `next.config.mjs` — `serverComponentsExternalPackages: ['better-sqlite3']`
- [x] `npx tsc --noEmit` 0 errors
- [x] `npx next build` 통과 (10 routes 정상 빌드)

### Phase 4 — Python sink 전환 (HTTP → SQLite 직접) (완료)
- [x] `integration/supabase_sink.py` 폐기, `integration/sqlite_sink.py` 신규 작성
  - `sqlite3` 표준 라이브러리 사용
  - `push_update_records`, `push_version_history`, `flush_pending_queue` 동일 시그니처 유지
  - 락 발생 시 0.5초 sleep 후 1회 재시도, 실패 시 큐로 폴백
- [x] `dry_run.py` sink 교체 (`from sqlite_sink import ...`)
- [x] `patch_main.md` 텍스트 업데이트 (모듈명 `supabase_sink` → `sqlite_sink`, 환경변수 변경)
- [x] `README.md` 업데이트 (Supabase 셋업 → SQLite 셋업, 트러블슈팅 항목 교체)
- [x] `.env.example` — `GTVS_DB_PATH=C:/GTVS/dashboard/db/gtvs.db`
- [x] `requirements.txt` — `requests` 제거, `python-dotenv` 만 유지
- [x] **검증**: `python dry_run.py --records 3 --history 2` 실행 → `update_records=3, version_history=2` 로 실제 INSERT 확인

### Phase 5 — 운영 자동화 (Windows 작업 스케줄러)
- [x] `scripts/backup.py` 신규 — SQLite online backup API + Google Drive 폴더 복사 + 30일 자동 삭제
- [x] `scripts/start-dashboard.ps1` 신규 — Next.js production 서버 hidden 기동
- [x] `docs/laptop-operations.md` 신규 — 작업 스케줄러 등록 PowerShell 명령 + 트러블슈팅
- [x] **검증**: `backup.py` 실행 시 SQLite online backup 정상 동작 (gtvs-YYYYMMDD.db 생성 확인)
- [x] `.gitignore` 에 `logs/` 추가
- [ ] **사용자 작업**: `Register-ScheduledTask "GTVS Dashboard"` (로그온 시 자동 기동)
- [ ] **사용자 작업**: `Register-ScheduledTask "GTVS Backup"` (매일 새벽 3시)
- [ ] **사용자 작업**: 1회 수동 실행 + Google Drive 동기화 확인

### Phase 6 — 자체 테스트
- [x] `db/migrations/001_init.sql` + `002_seed.sql` 로 `gtvs.db` 초기화 → 테이블/시드 확인 (Phase 2 사전 검증)
- [x] Python `dry_run.py --records 3 --history 2` → `gtvs.db` 에 INSERT 확인 (Phase 4 검증 — update_records 3, version_history 2)
- [x] `backup.py` 실행 시 online backup API + 파일 생성 동작 (Phase 5 검증 — 임시 폴더로 검증)
- [ ] **사용자 작업**: 초기 사용자 1명 등록 (`node --env-file=.env.local scripts/create_user.mjs admin@kaongroup.com "비밀번호" "관리자"` — PowerShell 에서 `<>` 는 redirection 예약 문자라 쓰지 말고 따옴표 사용)
- [ ] **사용자 작업**: `npm run dev` → 로그인 → Overview/Records/History 에 더미 데이터 표시 확인
- [ ] **사용자 작업**: `patch_main.md` 따라 `gtvs_updater/main.py` 실제 패치 + 1사이클 실행 → 대시보드 실 데이터 표시 확인
- [ ] **사용자 작업**: 검증 후 더미 데이터 정리 (`STB-DRY-*` row 삭제)

---

## 외부 노출 + Gemini AI 연동 (2026-05-28 결정 — Quick Tunnel + Gemini 무료 티어)

`context-notes.md` 2026-05-28 섹션 참조. 도메인 없이 `*.trycloudflare.com` 임시 URL로 시작, 필요 시 Named Tunnel로 전환. Gemini API는 무료 티어(2.5 Flash/Flash-Lite)로 운영.

### P0 — 결정 정리 + 문서 갱신
- [x] `context-notes.md` 2026-05-28 섹션 추가 (Gemini 오해 정리 + cloudflared 선택 이유)
- [x] `checklist.md` 본 섹션 추가

### P1 — Cloudflare Quick Tunnel
- [ ] cloudflared 설치 (winget `Cloudflare.cloudflared`)
- [ ] `cloudflared tunnel --url http://localhost:3000` 1회 수동 기동 → 발급 URL로 다른 네트워크에서 접속 검증
- [ ] `web/scripts/start-tunnel.bat` + `start-tunnel.vbs` 신규 — hidden 백그라운드 기동, `.runlogs/tunnel.log`에 적재
- [ ] `.runlogs/tunnel-url.txt`에 매 기동 시 발급 URL 자동 기록 (로그 파서)
- [ ] Task Scheduler 작업 "GTVS Tunnel" 등록 — 로그온 시 자동 기동
- [ ] **사용자 작업**: 외부 노트북에서 `tunnel-url.txt`의 URL로 접속 + NextAuth 로그인 동작 확인

### P2 — Gemini 공통 클라이언트
- [x] `.env.local`에 `GEMINI_API_KEY=` 자리 추가 — **사용자 작업**: https://aistudio.google.com/apikey 에서 발급 후 값 입력
- [x] `lib/gemini.ts` 신규 — fetch 기반 Gemini 2.5 Flash 호출 래퍼 + SHA-256 캐시
- [x] 호출 결과를 `gemini_cache` 테이블에 (input_hash, model, output, created_at) 캐시 — 무료 한도 보호
- [x] 마이그레이션 `005_gemini_cache.sql` 작성 + 적용 (gtvs.db에 테이블/인덱스 생성 확인)
- [x] `npx tsc --noEmit` 0 errors

### P3 — Overview 요약 카드 (A)
- [x] `lib/queries.ts`에 `getOverviewSnapshotForLlm()` 추가 — 변경 100건/오류 50건 한도로 LLM 입력 생성
- [x] `app/(app)/overview-summary-card.tsx` 신규 — Server Component, Gemini 호출 + 안전 폴백(키 미설정/0건/오류)
- [x] `app/(app)/page.tsx` 상단에 `<Suspense>` 감싼 `<OverviewSummaryCard>` 삽입 — 페이지 본문은 먼저 렌더, 카드는 뒤따라 채움
- [x] 캐시 키 — `lib/gemini.ts`의 SHA-256(model + prompt). 같은 스냅샷이면 재호출 X
- [x] `npx tsc --noEmit` 0 errors
- [ ] **사용자 작업**: `.env.local`에 GEMINI_API_KEY 입력 후 빌드+재시작 → 실제 응답 확인

### P4 — 에러/manual 이력 AI 코멘트 (C)
- [ ] Records/History 행에 "AI 코멘트" 버튼 — 클릭 시 server action으로 Gemini 호출
- [ ] `status=error` 또는 `source=manual` 행에만 노출
- [ ] 결과는 행 펼침 영역에 표시 + 캐시

### P5 — 자연어 질의 챗봇 패널 (B)
- [ ] 좌측 사이드바 하단에 챗봇 토글 버튼
- [ ] 사전 정의 인텐트 → SQL 매핑(LLM이 임의 SQL 생성하지 않도록 안전 가드)
- [ ] 응답 스트리밍 (Gemini SSE 또는 chunk fetch)

### P4 — Records/History 행 AI 코멘트 (C)
- [x] `app/actions/ai-comment.ts` — `commentOnHistory(id)` / `commentOnRecord(id)` server actions
- [x] `app/(app)/history/history-table.tsx` 신규 — source='manual' 행에 AI 분석 버튼 + 펼침 영역
- [x] `tsc --noEmit` 0 errors
- [ ] **사용자 작업**: GEMINI_API_KEY 입력 + 빌드/재시작 후 manual 행에서 동작 확인
- [ ] Records의 error cell에도 AI 분석 적용 (현재는 server action만, UI 후속)

### P5 — 자연어 질의 챗봇 (B)
- [x] `app/actions/chat.ts` — `askChat(history)` server action (보고 윈도우 데이터 + 대화 히스토리)
- [x] `app/(app)/chat/page.tsx` + `chat-ui.tsx` — 메시지 누적 + 전송 UI
- [x] 사이드바에 `/chat` 메뉴 추가 (Sparkles icon)
- [x] 안전 — LLM 에 SQL 생성 권한 없음. 보고 윈도우 데이터만 입력
- [ ] **사용자 작업**: GEMINI_API_KEY 입력 + 빌드/재시작 후 채팅 검증

### P6 — Python reporter 이메일에 Gemini 요약 (D)
- [x] 2026-05-29 — 추가 완료(`a3dd95c`) → **2026-05-29 저녁 제거** (C 결정, 나중에 다시 활성화 예정)
- 복원 가이드 — `context-notes.md` 2026-05-29(저녁) 섹션 참조

---

## 시나리오 자동 테스트 시스템 (2026-05-29 — PT1~PT7 진행 중)

상세 단계별 진행은 `context-notes.md` 2026-05-29 섹션 참조.

### PT1 — 마이그레이션 006/007
- [x] `006_test_runs.sql` — test_runs / manual_checks 테이블 + packages.test_supported
- [x] `007_na_kt_launcher.sql` — TV Launcher / Google TV Home N/A 마킹 (양쪽 단말 KT)
- [x] gtvs.db 적용 확인 (N/A 6개)

### PT2 — 시나리오 YAML (12개 패키지)
- [x] Katniss / SetupWraith / GmsCore / MediaShell / WebViewGoogle / talkback / TvCoreServices / RemoteService / Backdrop / YouTube / LatinImeGoogle / PlayStore
- [x] 자동 step 41건 + 수동 점검 50건 (Katniss Phase A 음성 검색 추가 후 +1 자동)

### PT3 — `scenario_runner.py` (Python)
- [x] yaml 로드 + step dispatcher + assertion + sqlite test_runs INSERT
- [x] step 18종 (Phase A 신규 3종 포함) + assertion 16종 (Phase A 3종 포함)
- [x] CLI — `--device / --device-name / --ref / --triggered-by / --include-risky / --json`

### PT4 — 대시보드 Server Action
- [x] `app/actions/tests.ts` — `runScenario(device, ref, includeRisky?)` + `recordManualCheck(...)`
- [x] Python spawn + UTF-8 환경변수 + 10분 타임아웃 + revalidatePath

### PT5 — tests-grid 통합 UI
- [x] 셀에 통합 판정 뱃지 (PASS / FAIL / WAIT / N/A / —)
- [x] 셀 클릭 시 펼침 — 자동 시나리오 표 + 수동 체크박스(PASS/FAIL/SKIP)
- [x] Run Test / Run + Risky 버튼

### PT6 — 자동 트리거 통합 가이드
- [x] `integration/patch_smoke.md` 작성 — `main.py` 의 `run_check()` 끝에 `_trigger_scenarios()` 호출 3단계 패치
- [ ] **사용자 작업**: main.py 패치 적용 후 `python main.py --once` 검증

### PT7 — Phase A 자동화 확장 (OCR + 음성 검색)
- [x] scenario_runner — screen_capture / screen_capture_ocr / am_voice_search step + assert_ocr_* assertion
- [x] Tesseract 자동 탐색 (TESSERACT_EXE 환경변수 → 표준 경로 → PATH 순)
- [x] Katniss yaml — `voice_search_result_page` 자동 step 추가
- [ ] **사용자 작업**: Tesseract OCR 설치 검증 (kor + eng), 다른 패키지 yaml dump 키워드 보정

### 자동 시작 — Task Scheduler 작업 2개
| 작업명 | 동작 | 트리거 |
|---|---|---|
| GTVS Dashboard | `start-prod.vbs` → `next start` | 로그온 시 (기존) |
| GTVS Tunnel | `start-tunnel.vbs` → `cloudflared tunnel --url http://localhost:3000` | 로그온 시 (P1에서 신규) |
