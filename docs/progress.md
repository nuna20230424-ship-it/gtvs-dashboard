# GTVS Dashboard 진행 보고

> **작성**: 2026-05-20 · keonhee.cho@kaongroup.com (with Claude Code)
> **상태**: 코드/스크립트/가이드 작성 완료 · 사용자 측 실 운영 등록 대기 (Phase 6)
> **저장소**: https://github.com/nuna20230424-ship-it/gtvs-dashboard

---

## 1. 무엇을 만들었나

QA 담당자(본인) 노트북 안에서만 동작하는 GTVS 패키지 업데이트 추적 대시보드.

- **수집** — 기존 `gtvs_updater`(Python, 매일 08/18시 작업 스케줄러 실행)가 STB 두 대의 패키지 18종 버전을 체크. **이번 작업으로 결과를 SQLite(`gtvs.db`)에 추가 INSERT**. 기존 jsonl 기록과 메일 발송은 그대로 유지.
- **저장** — 같은 노트북의 SQLite 파일 1개. WAL 모드로 동시 쓰기/읽기 안전. 매일 새벽 3시 Google Drive 폴더로 자동 백업, 30일 보관 후 삭제.
- **조회** — Next.js 14 대시보드. `http://localhost:3000` 본인 로그인. Overview/Records/History/Tests/Settings 5개 페이지. 필터·페이지네이션·active 토글 모두 동작.
- **인증** — NextAuth v5 + `users` 테이블 + bcrypt 해시. 단일 사용자.
- **외부 통신** — 0건. 사내 SaaS 의존 0. 외부 노출 0.

## 2. 왜 이런 구조가 됐나 (결정 흐름)

| 단계 | 후보 | 결정 | 폐기 이유 |
|---|---|---|---|
| 1차 | Supabase Cloud | **폐기** | 사내 제품/디바이스 식별 정보를 외부 SaaS(AWS Seoul)에 누적. 회사 보안 정책 위반 가능성. service_role 키 유출 시 RLS 우회로 전체 노출 |
| 2차 | Mac mini self-host + Tailscale VPN | **폐기** | Tailscale 클라이언트 설치 자체가 보안 이슈. 외부 기기(Mac mini)에 VPN을 두는 것이 새 공격 표면 |
| 3차 (최종) | **노트북 단독 + SQLite + localhost** | **채택** | 외부 통신 0. VPN 불필요. SaaS 의존 0. 본인 단독 사용에 적합. 단순함과 보안이 동시에 충족 |

상세는 `context-notes.md`. 폐기 문서는 `docs/archive/` 보존(참조용).

## 3. 아키텍처

```
[본인 Windows 노트북]
    ├─ gtvs_updater (Python)
    │      └─ adb → STB 체크 → sqlite_sink → gtvs.db
    ├─ gtvs.db (SQLite 파일 1개)
    │      └─ 매일 03:00 → Google Drive (30일 보관)
    └─ Next.js (npm run start)
           └─ localhost:3000 (NextAuth 로그인)
```

같은 노트북 안에서 모두 동작. 외부 도메인 호출 0건.

## 4. 작업 분할과 완료 상태

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | 결정 정리 + Supabase/Mac mini 자산 archive 처리 | 완료 |
| 2 | SQLite 호환 마이그레이션 + `gtvs.db` 초기화 + 노트북 셋업 가이드 | 완료 (DB 생성·검증 완료) |
| 3 | Next.js `@supabase/*` 제거 → NextAuth v5 + better-sqlite3 + `lib/queries.ts` | 완료 (`npx next build` 통과) |
| 4 | Python sink Supabase REST → SQLite 직접 INSERT | 완료 (`dry_run.py` 검증) |
| 5 | 운영 자동화 — `backup.py`, `start-dashboard.ps1`, 작업 스케줄러 가이드 | 완료 (backup 검증) |
| 6 | 실 운영 등록 + 1사이클 검증 | **사용자 진행 대기** |

## 5. 주요 검증 결과

| 항목 | 결과 |
|---|---|
| `gtvs.db` 초기화 | 5 테이블 + WAL 모드 + 시드 (devices 2, packages 18) |
| TypeScript `tsc --noEmit` | 0 errors |
| Next.js production build | 10 routes 정상 (`/`, `/login`, `/records`, `/history`, `/settings`, `/tests` 등) |
| Python `dry_run.py --records 3 --history 2` | `gtvs.db` 에 update_records 3건, version_history 2건 실제 INSERT 확인 |
| `backup.py` | SQLite online backup API 동작, `gtvs-YYYYMMDD.db` 생성 |

## 6. 사용자가 직접 할 일 (Phase 6)

### 6-1. 초기 사용자 등록 (1분)
PowerShell 에서 `<`, `>` 는 redirection 예약 문자라 사용 불가. 값은 따옴표로 감싸서 직접 입력한다.
```powershell
cd C:\GTVS\dashboard\web
node --env-file=.env.local scripts/create_user.mjs admin@kaongroup.com "MySecretPwd123!" "관리자"
```

### 6-2. 대시보드 검증 (3분)
```powershell
npm run dev
# 브라우저: http://localhost:3000 → 로그인 → Overview/Records/History 데이터 확인
```

### 6-3. 운영 자동화 등록 (5분, `docs/laptop-operations.md` 따라)
- `Register-ScheduledTask "GTVS Dashboard"` (로그온 시 자동 기동)
- `Register-ScheduledTask "GTVS Backup"` (매일 03:00)

### 6-4. gtvs_updater 실 패치 (5분, `integration/patch_main.md` 따라)
- `main.py` 에 7줄 추가 → 다음 스케줄 실행 또는 `--once` 로 1회 검증

### 6-5. 더미 데이터 정리
```powershell
python -c "import sqlite3; c = sqlite3.connect('C:/GTVS/dashboard/db/gtvs.db'); c.execute(\"delete from update_records where device like 'STB-DRY-%'\"); c.execute(\"delete from version_history where device like 'STB-DRY-%'\"); c.commit(); c.close(); print('OK')"
```

## 7. 향후 확장 여지

- **다중 사용자 / 외부 접속** — 현재 `lib/queries.ts` 가 분리되어 있어서 API Route 추가만으로 외부 호출 가능 (사내 API Route 형태로). 별도 인증 정책은 추가 필요.
- **Postgres 이전** — `db/migrations/postgres/001_init.sql` 보존됨. SQL 95% 재사용 가능. `better-sqlite3` → `pg` 교체와 `pragma` 구문 제거만 하면 됨.
- **Supabase Cloud 복귀** — 보안 정책이 변경되면 self-host 또는 Cloud 로 이전 가능. 데이터 마이그레이션은 `pg_dump` 호환 형태로 수행.

## 8. 운영상 알아둘 점

| 주제 | 메모 |
|---|---|
| 데이터 소유 | 모든 데이터는 본인 노트북 + Google Drive 백업에만 존재. 외부 SaaS 0. |
| 가용성 | 노트북 켜져 있고 사용자 로그인된 동안만. 절전·종료 시 대시보드와 수집기 모두 멈춤. 매일 켜놓는 운영 패턴 전제. |
| 백업 | `gtvs-YYYYMMDD.db` 가 Google Drive 동기화 폴더에 일 1회 누적, 30일 보관. 노트북 분실 시 복구 가능. |
| 시크릿 | `.env.local`(web), `.env`(integration) 둘 다 `.gitignore` 로 외부 노출 차단. `AUTH_SECRET` 은 32B 랜덤. |
| 로그 | `logs/dashboard-YYYYMMDD.log` (Next.js), `pending_upload.jsonl` (sink 실패 큐) |
| Git | 모든 코드와 문서는 `nuna20230424-ship-it/gtvs-dashboard` (private). 데이터 / 시크릿 / node_modules / 빌드 산출물은 추적 안 함. |

---

## 부록 A. 의존성 변경 요약

### web/package.json
- 제거: `@supabase/ssr`, `@supabase/supabase-js`
- 추가: `next-auth@5.0.0-beta.25`, `better-sqlite3@^12`, `bcryptjs@^2.4.3`, 그에 따른 `@types/*`

### integration/requirements.txt
- 제거: `requests`
- 유지: `python-dotenv`
- 추가: 없음 (`sqlite3` 는 표준 라이브러리)

## 부록 B. git 커밋 흐름

```
40ca177  feat: 운영 자동화 스크립트 + 가이드 (Phase 5)
50714ba  feat: Python sink 를 Supabase REST → SQLite 직접 INSERT 로 전환 (Phase 4)
36f78c7  refactor: 페이지/Auth 를 NextAuth + better-sqlite3 로 전환 (Block 2~4)
bbfcf0a  feat: Auth/DB 기반 lib 도입 (next-auth v5 + better-sqlite3)
ff145c2  chore: SQLite 기반 단일 노트북 운영 구조 초기 셋업
```
