# GTVS Dashboard 구축 보고

> **작성일**: 2026-05-19
> **작성자**: keonhee.cho@kaongroup.com (with Claude Code)
> **상태**: 코드 구현 완료 / 운영 환경 셋업(Supabase 프로젝트 생성·통합 반영) 대기

---

## 1. 요약 (TL;DR)

기존 GTVS Updater(Google TV 단말의 Play Store 패키지 자동 업데이트 파이썬 시스템)의 실행 결과를 **Supabase**에 미러링하고, **Next.js 14 웹앱 대시보드**에서 조회·관리할 수 있도록 구축했다. 패키지별 자동화 테스트 메뉴는 자리만 잡아두고 향후 자동화 스크립트가 연결될 슬롯을 확보했다.

| 항목 | 결과 |
|---|---|
| 구현 위치 | `C:\GTVS\dashboard\` |
| DB / Auth | Supabase (Postgres + PostgREST + Auth) |
| 프론트엔드 | Next.js 14 (App Router) + Tailwind + 자작 shadcn-스타일 UI |
| Python 통합 | `requests` 기반 sink 모듈, 기존 `main.py`에 7줄 추가 |
| 자체 테스트 | Next.js `next build` 성공 / Python dry-run 정상 / TS type-check 통과 |
| 사용자 작업 필요 | Supabase 프로젝트 생성, SQL 적용, `.env` 작성, `main.py` 패치 7줄 |

---

## 2. 배경 및 목표

### 2.1 기존 시스템

- 위치: `C:\Users\k251110\Desktop\qa-automation\gtvs_updater\`
- 실행: Windows 작업 스케줄러 (`GtvsUpdater_AM` 08:00, `GtvsUpdater_PM` 18:00)
- 동작: 단말 2대(STB-01 beta / STB-02 production)에 ADB 접속 → Play Store에서 18개 패키지 버전 조회·업데이트 → JSONL 파일 기록 + 이메일 발송
- 한계: **결과가 로컬 파일(.jsonl)에만 남아 다수 인원이 동시에 확인하기 어려움**, 시각화 부재, 패키지별 수동 테스트 진입점 없음

### 2.2 요구사항

1. beta/production 업데이트 이력과 조회한 버전 정보를 **서버에 저장**
2. 항상 확인 가능한 **웹앱 대시보드** (조회시간·패키지·앱·ref·이전버전·현재버전·이력·날짜·시간·상태)
3. 패키지별 **테스트 진입 메뉴** (TC는 향후 자동화 스크립트로 연결)
4. 파트별 **에이전트 분담** 구현
5. 진행 전 **사용자 확인**
6. 모든 구현 후 **자체 테스트**

---

## 3. 의사결정 요약

| 항목 | 선택 | 이유 |
|---|---|---|
| 서버 / DB | **Supabase (Seoul region)** | 외부·모바일에서도 접근 가능, Auth/실시간/대시보드 내장, 무료 티어 충분, 향후 self-host 옵션도 열림 |
| 프론트엔드 스택 | **Next.js 14 + Tailwind** | 풀스택 단일 프로젝트, Supabase SSR 공식 지원 |
| 인증 | **Supabase Auth (Email/Password)** | 사내 IDP 연동은 후속 과제, 우선 MVP |
| 프로젝트 위치 | **`C:\GTVS\dashboard\`** | GTVS 관련 자산 통합 시작점 |
| 기존 코드 수정 정책 | **`gtvs_updater/main.py`에 7줄만 추가, 0줄 수정** | 기존 jsonl이 single source of truth, Supabase는 mirror |
| 테스트 메뉴 | **placeholder만** | 자동화 스크립트는 별도 작업 |

전체 결정 이력은 `C:\GTVS\dashboard\context-notes.md` 참고.

---

## 4. 아키텍처

```
┌────────────────────────────┐
│  Windows 작업 스케줄러     │
│  (08:00 / 18:00)           │
└────────────┬───────────────┘
             │ run_gtvs_updater_once.bat
             ▼
┌────────────────────────────┐         ┌──────────────────────┐
│  gtvs_updater (Python)     │         │  pending_upload.jsonl│
│  - ADB → Play Store        │         │  (실패 시 로컬 큐)   │
│  - update_history.jsonl    │         └──────────┬───────────┘
│  - version_history.jsonl   │                    │
│  - 이메일 발송             │                    │ flush
│                            │                    │
│  + supabase_sink (추가)    │────POST───────────┐│
└────────────────────────────┘                   ▼▼
                                    ┌─────────────────────────┐
                                    │  Supabase               │
                                    │  ┌─────────────────┐    │
                                    │  │ Postgres        │    │
                                    │  │ - devices       │    │
                                    │  │ - packages      │    │
                                    │  │ - update_records│    │
                                    │  │ - version_history    │
                                    │  └─────────────────┘    │
                                    │  + PostgREST + Auth     │
                                    │  + RLS                  │
                                    └────────────┬────────────┘
                                                 │ HTTPS + JWT
                                                 ▼
                                    ┌─────────────────────────┐
                                    │  Next.js 대시보드        │
                                    │  (브라우저)              │
                                    │  /login                  │
                                    │  / (Overview)            │
                                    │  /records                │
                                    │  /history                │
                                    │  /tests                  │
                                    │  /settings               │
                                    └─────────────────────────┘
```

### 데이터 흐름 원칙

- **로컬 jsonl = single source of truth**, Supabase = mirror
- Python sink는 **절대 예외를 던지지 않음**. 실패 시 `pending_upload.jsonl`로 큐잉, 다음 실행 시작에 자동 flush
- 대시보드 클라이언트는 **anon key** 사용, INSERT는 service_role 전용(Python에서만)

---

## 5. 데이터베이스 스키마

### `devices` — 단말 마스터
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigserial PK | |
| name | text UNIQUE | 예: STB-01 |
| track | text CHECK | beta / production |
| ip | text | adb connect 대상 |
| port | int | 기본 5555 |
| active | boolean | 대시보드 노출 토글 |

### `packages` — 패키지 마스터 (18종)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigserial PK | |
| package | text UNIQUE | 안드로이드 패키지명 |
| app_name | text | Play Store 표시명 |
| ref | text | apkmirror 별칭 |
| active | boolean | 추적 대상 토글 |

### `update_records` — 매 체크마다 1행 (조회 기록)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigserial PK | |
| device | text | |
| track | text CHECK | beta / production / unknown |
| package | text | |
| ref | text | |
| app_name | text | |
| status | text CHECK | updated / up_to_date / error |
| version_before | text | |
| version_after | text | |
| error | text | |
| checked_at | timestamptz | UpdateRecord.timestamp |
| created_at | timestamptz | 기본 now() |

### `version_history` — 실제 버전 변경만 1행
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigserial PK | |
| device, track, package, app_name | text | |
| version_before, version_after | text | |
| source | text CHECK | auto / manual |
| changed_at | timestamptz | |
| created_at | timestamptz | |

### 인덱스
- `update_records (checked_at DESC)` — 대시보드 메인 타임라인
- `update_records (device, package, checked_at DESC)` — 단말×패키지 상세
- `update_records (track, status)` — "production에서 error만" 필터
- `version_history (changed_at DESC)`
- `version_history (device, package, changed_at DESC)`

### RLS 정책
- 4개 테이블 모두 RLS Enabled
- `authenticated` 역할: 4개 테이블 SELECT 가능, `devices` / `packages`만 UPDATE 가능(active 토글)
- `update_records` / `version_history`의 INSERT: `service_role` 전용 (Python 측에서만)

SQL 본문은 `C:\GTVS\dashboard\supabase\migrations\001_init.sql`, 시드는 `002_seed.sql`.

---

## 6. 대시보드 페이지

| 라우트 | 역할 | 주요 컬럼 / 동작 |
|---|---|---|
| `/login` | 이메일/비밀번호 로그인 | Supabase Auth, server action |
| `/` | Overview | devices × packages 매트릭스, 각 셀에 최신 버전·상태·체크 시각 |
| `/records` | 조회 기록 | 조회시간 / 단말+track / 패키지 / 앱이름 / ref / 이전·현재버전 / 상태 / 에러. 필터(track/device/package/status/날짜), 50건 페이지네이션 |
| `/history` | 버전 변경 이력 | 변경시각 / 단말+track / 패키지 / 앱 / 이전→현재 / source(auto·manual). 필터 동일 |
| `/tests` | 패키지×단말 그리드, "Run Test" 버튼 | **클릭 시 "준비 중 — 자동화 스크립트 연결 예정" toast 표시 (placeholder)** |
| `/settings` | devices/packages 표시 + active 토글 | 클라이언트에서 직접 UPDATE |

### 인증 흐름

- 미들웨어가 모든 요청에서 Supabase 세션 갱신 + 가드
- 비로그인 → `/login` 리다이렉트
- 로그인 사용자가 `/login` 접근 시 → `/` 리다이렉트

---

## 7. Python 통합

### 새 모듈 (`C:\GTVS\dashboard\integration\`)

| 파일 | 역할 |
|---|---|
| `supabase_sink.py` | `push_update_records`, `push_version_history`, `flush_pending_queue` 3개 함수. requests + dotenv만 사용 |
| `dry_run.py` | CLI 검증: `--records N --history N --flush` |
| `requirements.txt` | requests, python-dotenv |
| `.env.example` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `patch_main.md` | 기존 main.py에 추가할 7줄 diff |

### 기존 `main.py` 패치 (7줄 추가, 0줄 수정)

```diff
 from updater import run_update_check
 from reporter import send_update_report
+
+# Supabase 미러링 sink (대시보드용)
+sys.path.insert(0, r"C:\GTVS\dashboard\integration")
+from supabase_sink import push_update_records, push_version_history, flush_pending_queue
```

```diff
 def run_check() -> None:
     config = _load_config()
     now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
     print(f"\n[{now}] 업데이트 체크 시작.")
+
+    # 이전 실행에서 Supabase 전송 실패한 보류 큐 먼저 비우기
+    flush_pending_queue()

     records = run_update_check(...)
     _save_history(records)
+    push_update_records(records)
     _update_version_tracking(records)
```

```diff
     if new_entries:
         with open(_VERSION_HISTORY_PATH, "a", encoding="utf-8") as f:
             for e in new_entries:
                 f.write(json.dumps(e, ensure_ascii=False) + "\n")
         print(f"버전 변경 {len(new_entries)}건 기록.")
+        push_version_history(new_entries)
```

상세 diff는 `C:\GTVS\dashboard\integration\patch_main.md`.

---

## 8. 구현 작업 분담 (에이전트)

| 에이전트 | 범위 | 산출물 |
|---|---|---|
| Agent A (Backend) | Supabase 스키마, RLS, 시드, REST 호출 가이드 | `supabase/migrations/001_init.sql`, `002_seed.sql`, `supabase/README.md` |
| Agent B (Frontend) | Next.js 14 프로젝트 전체 (페이지/컴포넌트/Auth/미들웨어) | `web/` 디렉토리 전체 (40+ 파일) |
| Agent C (Integration) | Python sink, dry-run, 패치 가이드 | `integration/supabase_sink.py`, `dry_run.py`, `patch_main.md`, README |
| 메인 (통합 검증) | 자체 테스트, 타입 에러 수정, 보고 | 본 문서 |

3개 에이전트는 **병렬 실행**되어 약 30분 내 완료. 의존성은 사전에 스키마 컬럼명을 명확히 정의해 충돌 회피.

---

## 9. 자체 테스트 결과

| 검증 항목 | 결과 | 비고 |
|---|---|---|
| 디렉토리 / 파일 생성 | OK | 총 51개 파일 |
| Python 문법 (`ast.parse`) | OK | supabase_sink.py, dry_run.py |
| Python dry-run (no credentials) | OK | 큐로 정상 폴백, `pending_upload.jsonl`에 3건 적재 확인 |
| Python flush (no credentials) | OK | 큐 유지 |
| Next.js `npm install` | OK | 의존성 정상 설치 |
| TypeScript `tsc --noEmit` | 1차 실패 → 수정 후 OK | Supabase ssr `setAll` 콜백 파라미터 타입 명시(`CookieToSet[]`) |
| Next.js `next build` | OK | 10 라우트 모두 컴파일, 정적 페이지 10/10 |
| SQL 검토 | OK | 4 테이블 + 5 인덱스 + RLS 정책, 멱등성 보장 |

### 수정 내역

- `web/lib/supabase/middleware.ts`, `web/lib/supabase/server.ts`: `setAll` 콜백의 `cookiesToSet` 파라미터에 `CookieToSet[]` 타입 명시 (총 8개 implicit-any 에러 해소)

---

## 10. 사용자 후속 작업

### 10.1 Supabase 셋업 (약 10분)

상세 가이드: `C:\GTVS\dashboard\docs\supabase-setup.md`

1. https://supabase.com → New project → Region: **Northeast Asia (Seoul)**, Free plan
2. Project Settings → API에서 **Project URL**, **anon key**, **service_role key** 확인
3. SQL Editor에서 `001_init.sql` → `002_seed.sql` 순서 실행
4. Authentication → Users → "Add user" → Email/Password, Auto Confirm 체크

### 10.2 환경변수 작성

**`C:\GTVS\dashboard\web\.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**`C:\GTVS\dashboard\integration\.env`**

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### 10.3 대시보드 기동

```powershell
cd C:\GTVS\dashboard\web
npm run dev
# → http://localhost:3000
```

### 10.4 Python 통합 검증

```powershell
cd C:\GTVS\dashboard\integration
pip install -r requirements.txt
python dry_run.py --records 3 --history 2
# → Supabase 대시보드 update_records, version_history 테이블에 행이 들어오는지 확인
```

### 10.5 기존 main.py 패치

`C:\GTVS\dashboard\integration\patch_main.md` 따라 `C:\Users\k251110\Desktop\qa-automation\gtvs_updater\main.py`에 7줄 추가 → 다음 스케줄 실행부터 Supabase에 자동 반영.

---

## 11. 후속 과제

| 항목 | 우선순위 | 비고 |
|---|---|---|
| Tests 메뉴에 실제 자동화 스크립트 연결 | High | `/api/tests` 라우트가 placeholder(501)로 준비됨 |
| 사내 IDP 연동 (Supabase Auth → SAML/OIDC) | Medium | Supabase Pro 플랜 필요 시 검토 |
| 알람: error 발생 시 슬랙/이메일 트리거 | Medium | Supabase Database Webhook으로 구현 가능 |
| 데이터 보존 정책 (오래된 update_records 정리) | Low | 매일 18 행 × 365일 ≈ 7천 행/년, 당장은 무시 가능 |
| 모바일 뷰 최적화 | Low | 현재 데스크톱 우선 |

---

## 12. 디렉토리 구조 (최종)

```
C:\GTVS\dashboard\
├── README.md
├── checklist.md                       # 진행 체크리스트
├── context-notes.md                   # 결정 이력
├── docs\
│   ├── plan.md                        # 계획 문서
│   ├── supabase-setup.md              # Supabase 셋업 가이드
│   └── confluence-share.md            # 본 문서
├── supabase\
│   ├── README.md
│   └── migrations\
│       ├── 001_init.sql
│       └── 002_seed.sql
├── integration\
│   ├── README.md
│   ├── supabase_sink.py
│   ├── dry_run.py
│   ├── patch_main.md
│   ├── requirements.txt
│   └── .env.example
└── web\
    ├── README.md
    ├── package.json
    ├── next.config.mjs, tailwind.config.ts, tsconfig.json, postcss.config.mjs
    ├── middleware.ts
    ├── .env.local.example
    ├── app\
    │   ├── layout.tsx, globals.css
    │   ├── login\page.tsx
    │   ├── actions\auth.ts
    │   ├── api\tests\route.ts        # placeholder 501
    │   └── (app)\
    │       ├── layout.tsx, page.tsx (Overview)
    │       ├── records\page.tsx, error-cell.tsx
    │       ├── history\page.tsx
    │       ├── tests\page.tsx, tests-grid.tsx
    │       └── settings\page.tsx, active-toggle.tsx
    ├── components\
    │   ├── sidebar.tsx, header.tsx
    │   ├── filters\records-filters.tsx, history-filters.tsx
    │   └── ui\button, badge, input, select, table, dialog, toast.tsx
    └── lib\
        ├── format.ts
        └── supabase\client.ts, server.ts, middleware.ts
```

---

## 부록 A. Confluence 붙여넣기 팁

- 본 문서는 **GitHub-flavored Markdown** 기준으로 작성됨.
- Confluence는 Markdown 직접 붙여넣기 시 일부 표·코드블록 포맷이 깨질 수 있다.
- 권장 방법:
  - **Confluence Cloud**: 페이지 편집 → `/markdown` 매크로 → 본 문서 전체 붙여넣기
  - **Confluence Data Center**: Markdown for Confluence 같은 플러그인 사용 또는 페이지 편집 → `...` → "Import from Markdown"
  - 둘 다 불가하면 표·코드만 위지윅으로 재구성하고 본문은 텍스트 복사

## 부록 B. 참조 파일 경로

| 목적 | 경로 |
|---|---|
| 계획 | `C:\GTVS\dashboard\docs\plan.md` |
| 진행 체크리스트 | `C:\GTVS\dashboard\checklist.md` |
| 결정 이력 | `C:\GTVS\dashboard\context-notes.md` |
| Supabase 셋업 | `C:\GTVS\dashboard\docs\supabase-setup.md` |
| 스키마 SQL | `C:\GTVS\dashboard\supabase\migrations\001_init.sql` |
| 시드 SQL | `C:\GTVS\dashboard\supabase\migrations\002_seed.sql` |
| Python sink | `C:\GTVS\dashboard\integration\supabase_sink.py` |
| 기존 main.py 패치 | `C:\GTVS\dashboard\integration\patch_main.md` |
| 웹 README | `C:\GTVS\dashboard\web\README.md` |
