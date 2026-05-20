# GTVS Dashboard

GTVS 패키지(beta/production) 버전 업데이트 이력을 같은 노트북의 SQLite에 저장하고
Next.js 대시보드(localhost:3000)에서 조회하는 단일 노트북 운영 시스템.

> **운영 형태** — 본인 Windows 노트북 단독, 외부 네트워크 의존 0, Google Drive 일일 백업.
> 결정 흐름(왜 Supabase/Mac mini 안을 폐기했는지)은 `context-notes.md` 참조.

## 아키텍처

```
[본인 Windows 노트북 — 모든 컴포넌트가 같은 기기 안]
    │
    ├─ gtvs_updater  (Python, 기존 자산)
    │      └─ adb로 STB 체크 → sqlite_sink → gtvs.db INSERT
    │
    ├─ gtvs.db  (SQLite 파일 1개, WAL 모드)
    │      └─ 매일 새벽 3시 → Google Drive 동기화 폴더 자동 백업 (30일 보관)
    │
    └─ Next.js 대시보드  (npm run start)
           └─ http://localhost:3000  ─ 본인만 접속 (NextAuth 로그인)
```

## 폴더 구조

```
dashboard/
├── README.md             ← 이 파일
├── checklist.md          ← Phase 1~6 진행 체크박스
├── context-notes.md      ← 결정 이력 (Supabase → Mac mini → 노트북 단독)
├── db/
│   ├── gtvs.db           ← SQLite 데이터 파일 (.gitignore)
│   └── migrations/
│       ├── 001_init.sql  ← 5개 테이블 + WAL + 인덱스
│       ├── 002_seed.sql  ← devices 2 + packages 18
│       └── postgres/     ← (참조용) Postgres 호환판
├── web/                  ← Next.js 14 + NextAuth + better-sqlite3
│   ├── auth.config.ts, auth.ts, middleware.ts
│   ├── lib/db.ts, queries.ts, filters.ts
│   ├── app/(app)/{,records,history,settings,tests}/page.tsx
│   ├── app/login/page.tsx, app/actions/{auth,settings}.ts
│   └── scripts/create_user.mjs   ← 초기 사용자 등록
├── integration/          ← gtvs_updater ↔ gtvs.db 어댑터 (Python)
│   ├── sqlite_sink.py    ← push_update_records / push_version_history / flush_pending_queue
│   ├── dry_run.py
│   └── patch_main.md     ← gtvs_updater/main.py 에 7줄 추가하는 가이드
├── scripts/
│   ├── backup.py            ← SQLite online backup → Google Drive
│   └── start-dashboard.ps1  ← Next.js production 자동 기동
└── docs/
    ├── laptop-setup.md       ← Phase 2 DB 초기화 가이드
    ├── laptop-operations.md  ← Phase 5 운영 자동화 가이드
    ├── progress.md           ← 진행 요약 (컨플루언스 공유용)
    └── archive/              ← 폐기된 문서 (Supabase / Mac mini)
```

## 빠른 시작 (처음 사용 시)

이미 Phase 1~5 가 완료된 상태. 사용자가 직접 할 일은 Phase 6 뿐.

```powershell
# 1) 초기 사용자 등록 (한 번만) — 비밀번호는 따옴표로 감싸기 (PowerShell 에서 <,> 는 예약 문자라 쓸 수 없음)
cd C:\GTVS\dashboard\web
node --env-file=.env.local scripts/create_user.mjs admin@kaongroup.com "MySecretPwd123!" "관리자"

# 2) 대시보드 production 빌드 + 기동
npm run build
npm run start
# 브라우저: http://localhost:3000 → 로그인

# 3) 운영 자동화 등록 (한 번만, docs/laptop-operations.md 참조)
#   - Register-ScheduledTask "GTVS Dashboard"  (로그온 시 자동 기동)
#   - Register-ScheduledTask "GTVS Backup"     (매일 새벽 3시)

# 4) gtvs_updater 실 패치 (한 번만, integration/patch_main.md 참조)
#   - main.py 에 sink 호출 7줄 추가
```

## 주요 문서

| 문서 | 용도 |
|---|---|
| `docs/laptop-setup.md` | 노트북 환경 준비 + DB 초기화 (Phase 1~2 — 이미 완료) |
| `docs/laptop-operations.md` | 운영 자동화 — 작업 스케줄러 등록, 백업, 로그 점검 (Phase 5) |
| `integration/patch_main.md` | gtvs_updater/main.py 에 7줄 추가하는 diff (Phase 6) |
| `integration/README.md` | sqlite_sink 모듈 사용법 + 트러블슈팅 |
| `docs/progress.md` | 진행 요약 (외부 공유용) |
| `checklist.md` | Phase 1~6 상세 체크박스 |
| `context-notes.md` | 결정 흐름과 이유 |
| `docs/archive/` | 폐기된 Supabase / Mac mini 시절 문서 (참조용) |

## 상태

- Phase 1 — 결정 정리 + 폐기 자산 정리 **완료**
- Phase 2 — SQLite 스키마 + 가이드 **완료**
- Phase 3 — Next.js Supabase 제거 → NextAuth + better-sqlite3 **완료** (build 통과)
- Phase 4 — Python sink HTTP → SQLite 직접 INSERT **완료** (dry_run 검증 OK)
- Phase 5 — 운영 자동화 스크립트 + 가이드 **완료** (backup 검증 OK)
- Phase 6 — 실 운영 등록 (사용자 직접 진행)

상세는 `checklist.md`.

## GitHub

https://github.com/nuna20230424-ship-it/gtvs-dashboard
