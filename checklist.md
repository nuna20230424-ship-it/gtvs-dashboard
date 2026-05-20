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
