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

### Phase 3 — Next.js 전환 (Supabase 제거 → SQLite + NextAuth)
- [ ] `package.json` 의존성 교체 (`@supabase/*` 제거, `better-sqlite3`, `next-auth`, `bcryptjs` 추가)
- [ ] `lib/db.ts` 신규 — `better-sqlite3` 싱글톤, WAL 모드 활성화
- [ ] `lib/auth.ts` 신규 — NextAuth Credentials Provider (users 테이블 조회)
- [ ] `app/api/auth/[...nextauth]/route.ts` 신규
- [ ] `app/api/records/route.ts`, `app/api/history/route.ts`, `app/api/overview/route.ts` 신규 (조회용)
- [ ] `app/api/devices/route.ts`, `app/api/packages/route.ts` 신규 (Settings 페이지용)
- [ ] `middleware.ts` → NextAuth 기반으로 교체
- [ ] 로그인 페이지 → NextAuth `signIn()`으로 교체
- [ ] 각 페이지(Overview/Records/History/Settings) 데이터 페칭을 `fetch('/api/...')`로 교체
- [ ] `.env.local` 신규 — `DB_PATH`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`
- [ ] `npx next build` 통과 확인

### Phase 4 — Python sink 전환 (HTTP → SQLite 직접)
- [ ] `integration/supabase_sink.py` 폐기, `integration/sqlite_sink.py` 신규 작성
  - `sqlite3` 표준 라이브러리 사용
  - `insert_update_records(records: list)`, `insert_version_history(entries: list)` 동일 인터페이스
- [ ] `dry_run.py` sink 교체
- [ ] `patch_main.md` 텍스트 업데이트 (모듈명 변경, .env 항목 변경)
- [ ] `.env` 신규 — `GTVS_DB_PATH=C:\GTVS\dashboard\db\gtvs.db`

### Phase 5 — 운영 자동화 (Windows 작업 스케줄러)
- [ ] Next.js 자동 시작 — `pm2` 또는 작업 스케줄러로 부팅 시 `next start` 기동
- [ ] DB 백업 작업 — 매일 새벽 3시 `sqlite3 gtvs.db ".backup ..."` → Google Drive 폴더로 복사
- [ ] 30일 이상 된 백업 자동 삭제

### Phase 6 — 자체 테스트
- [x] `db/migrations/001_init.sql` + `002_seed.sql`로 `gtvs.db` 초기화 → 테이블/시드 확인 (Phase 2 사전 검증에서 함께 처리됨)
- [ ] NextAuth용 사용자 1명 등록 (시드 또는 1회 스크립트)
- [ ] Python `dry_run.py --records 3 --history 2` → `gtvs.db`에 INSERT 확인
- [ ] `npm run dev` → 로그인 → Overview/Records/History에 데이터 표시 확인
- [ ] 백업 작업 1회 수동 실행 → Google Drive 폴더에 파일 생성 확인
- [ ] `patch_main.md` 따라 `gtvs_updater/main.py` 실제 패치 + 1사이클 검증
