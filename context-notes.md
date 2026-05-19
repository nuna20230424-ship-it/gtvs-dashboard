# GTVS Dashboard - Context Notes

진행 중 내려진 결정과 그 이유를 시간순으로 기록. 다음 세션에서 의사결정 재유도를 막기 위함.

## 2026-05-19

### DB로 Supabase 선택
- 후보: 로컬 SQLite, Supabase, 로컬 Postgres, 사내 공유 서버
- 결정: **Supabase**
- 이유: 외부/모바일에서도 확인 가능, Auth/실시간/대시보드 내장, 무료 티어 충분
- 트레이드오프: 인터넷 필요, 외부 의존성. 사내 보안 정책에 걸릴 경우 향후 self-host로 마이그레이션 옵션 열어둠 (Supabase는 self-host 가능)

### 프론트엔드 Next.js 선택
- 결정: **Next.js 14 App Router + Tailwind + shadcn/ui**
- 이유: 풀스택(서버 컴포넌트 + Route Handler) 단일 프로젝트, Supabase SSR 공식 지원

### 프로젝트 위치 `C:\GTVS\dashboard`
- 기존 GTVS 관련 자산이 흩어져 있어 한 곳으로 모으는 시작점. 향후 다른 GTVS 도구도 여기로 통합 가능.

### 인증: Supabase Auth (Email/Password)
- MVP에서는 단순 이메일 로그인. 사내 IDP 연동은 향후 과제.

### 에이전트 분담 구조 확정
- Agent A: Backend (Supabase 스키마/RLS/REST)
- Agent B: Frontend (Next.js 페이지/컴포넌트)
- Agent C: Integration (Python → Supabase POST)
- 최종 통합 테스트는 메인 세션이 직접 수행

### 기존 GTVS 데이터 구조 재사용
- `UpdateRecord` dataclass 필드를 그대로 테이블 컬럼으로 매핑
- `version_history.jsonl`의 항목 구조(`timestamp/device/track/package/app_name/version_before/version_after/source`) 그대로 `version_history` 테이블로
- **이유**: 기존 로직(`_update_version_tracking`)을 건드리지 않고 push만 추가하면 충돌 없이 통합 가능

### 통합 지점
- `gtvs_updater/main.py` `run_check()` 내부:
  - `_save_history(records)` 후 Supabase에 `update_records` POST
  - `_update_version_tracking(records)` 안에서 `new_entries`가 만들어진 후 Supabase에 `version_history` POST
- 실패해도 기존 jsonl 파일은 그대로 남아 데이터 손실 없음 (로컬 = single source of truth, Supabase = mirror)

### 테스트 메뉴 정책
- 우선 메뉴와 패키지×단말 셀, "Run Test" 버튼만 (클릭 시 toast "준비 중")
- 향후 자동화 스크립트 연결 시 Route Handler에서 워크플로우 트리거 예정

## 2026-05-19 (오후) — Supabase → Mac mini Postgres 전환

### 보안 재검토 결과 Supabase 폐기
- 우려: 사내 제품/디바이스 식별 정보가 외부 SaaS(AWS Seoul region)에 누적됨. 회사 정보보안 정책 위반 가능성.
- 추가 우려: service_role 키 유출 시 RLS 우회로 전체 DB 노출. Python 측 `.env`가 Windows PC NTFS ACL에 의존.
- 결정: **외부 SaaS 의존을 제거하고 사내 Mac mini로 이전**.

### 후보 평가 (Mac mini 전제)
| 후보 | 평가 |
|---|---|
| A. SQLite + Next.js | 가장 단순. DB 서버 불필요. 동시 쓰기 약점은 현 워크로드에 무관. 그러나 Python sink와 Next.js 모두 재작성 필요량이 가장 큼 |
| **B. Postgres(Docker) + Next.js API Route** | SQL 95% 재사용. 컨테이너 1개. 향후 Supabase Cloud 복귀도 호환. **채택** |
| C. Supabase self-host (Docker Compose) | 기존 코드 70% 재사용 가능하나 컨테이너 7~8개. Mac mini의 OBS/STB 대시보드와 공존 시 운영 부담 큼 |

### B안 채택. 핵심 결정 사항
- DB: **Postgres 17 Docker 컨테이너** (포트 5432, 데이터 볼륨 `/Users/dqa/gtvs-pg-data`)
- 백엔드 API: **Next.js Route Handler**에서 `pg`(node-postgres) 사용. 별도 백엔드 서버 두지 않음.
- Auth: **NextAuth (Credentials Provider, 이메일/비밀번호)**. Supabase Auth/`@supabase/ssr` 제거.
- Python ↔ Next.js: Python sink는 `service_role` 키 대신 **`X-API-Token` 헤더**를 들고 `/api/ingest/records`, `/api/ingest/history`로 POST. 토큰은 환경변수.
- **이유**: DB 자격증명을 Python 측에 두지 않음. 토큰 1개만 노출 표면. Next.js에서 토큰 검증 + 페이로드 검증 후 INSERT.

### 외부 접속 = Tailscale
- 후보: 회사 VPN / Tailscale / Cloudflare Tunnel / 포트포워딩+DDNS
- 결정: **Tailscale**
- 이유: 외부에 포트 노출 없음(메시 VPN, WireGuard 기반). 무료 100대까지. macOS/Win/iOS 모두 지원. Mac mini가 동적 IP여도 무관. 회사 도메인/공유기 권한 불필요.
- 운영: Mac mini, 본인 노트북, 폰을 같은 tailnet에 가입. Mac mini의 `100.x.x.x` IP로 접속.

### 포트 충돌 확인 (2026-05-19)
- Mac mini에서 `sudo lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3000|5432|8000|54321|4455) '` 결과 매칭 없음
- 따라서 Postgres 5432, Next.js 3000 그대로 사용 가능
- OBS, STB 대시보드는 다른 포트 사용 중 (충돌 없음 확정)

### 기존 산출물 재사용 정책
- `001_init.sql`: RLS 정책 블록(106~145행)만 제거하고 그대로 사용
- `002_seed.sql`: 그대로
- `web/` 페이지 컴포넌트(UI 부분): 그대로 유지, 데이터 페칭만 `fetch('/api/...')`로 교체
- `web/` Auth/`middleware.ts`: NextAuth 기준으로 재작성
- `integration/supabase_sink.py`: URL과 헤더만 교체 (Supabase REST POST 형식이 자체 API와 유사) → 새 이름 `dashboard_sink.py` 권장
- `integration/dry_run.py`, `patch_main.md`: sink 인터페이스 유지하면 그대로

## 2026-05-19 (저녁) — Mac mini도 폐기, 노트북 단독 + SQLite로 최종 전환

### Tailscale 설치 자체가 보안 이슈로 판단됨
- 사용자 제기: 회사 환경에서 별도 VPN 클라이언트(Tailscale)를 깔아 외부 기기(Mac mini)와 연동하는 것 자체가 보안 정책에 걸릴 가능성. 또한 외부 기기에 VPN을 두면 그 기기가 새 공격 표면이 됨.
- 결정: **Mac mini 운영안 폐기**. 외부 의존성을 모두 제거하고 **본인 Windows 노트북 단독으로** 운영.

### 사용 조건 (사용자 확인)
- 대시보드 사용자 = **본인만**
- 노트북은 매일 켜놓음 (가용 시간 = 노트북 가용 시간과 동일)
- 백업 = **Google Drive 동기화 폴더**에 `gtvs.db` 일 1회 자동 복사
- DB = **SQLite** (사용자 직접 지정)

### 최종 아키텍처
- 단일 노트북 안에 다음이 공존
  - `gtvs_updater` (Python, 기존) — adb로 STB 체크 후 `gtvs.db`에 직접 INSERT (HTTP 경유 안 함)
  - `gtvs.db` (SQLite 파일 1개) — `C:\GTVS\dashboard\db\gtvs.db` 위치 예정
  - Next.js 대시보드 — `next start` 또는 `npm run dev`로 `http://localhost:3000` 노출
- 외부 통신 0건. localhost 외에는 어떤 포트도 열지 않음.

### 인증
- localhost only라 강력한 인증은 과함
- 자리 비웠을 때 동료가 잠깐 봐도 곤란한 정도는 막기 위해 **NextAuth Credentials Provider + 사용자 1명**만 둠
- 비밀번호 해시는 `users` 테이블에 저장. 가입 절차는 없고 시드 데이터로 1명 INSERT.

### Python ↔ DB 통신 방식
- 기존 계획(HTTP POST → Next.js API Route → DB INSERT)을 폐기
- 같은 노트북 내에서 Python이 **SQLite 파일에 직접 INSERT** (`sqlite3` 표준 라이브러리)
- 이유: API 서버를 거치는 보안 가치가 0 (둘 다 같은 사용자 권한, 같은 노트북). 단순함이 우선.
- 동시성: SQLite WAL 모드 활성화로 Python INSERT와 Next.js SELECT 충돌 회피

### 기존 산출물 처분
- `docs/macmini-setup.md` → `docs/archive/`로 이동, 상단에 "폐기" 안내 추가
- `db/migrations/001_init.sql` (Postgres) → `db/migrations/postgres/001_init.sql`로 이동(참조용 보존)
- `db/migrations/001_init.sql` 자리에 **SQLite 호환판** 신규 작성
  - `bigserial` → `integer primary key autoincrement`
  - `timestamptz` → `text` (ISO8601 UTC 문자열)
  - `comment on ...` → SQLite 미지원이라 제거 (코멘트는 SQL 파일 내 주석으로 유지)
- 기존 `supabase/migrations/`, `integration/supabase_sink.py` 등 Supabase 흔적은 다음 Phase에서 정리

### 백업 정책 상세
- Windows 작업 스케줄러로 매일 새벽 3시
  - `gtvs.db` → `gtvs-YYYYMMDD.db`로 복사 → Google Drive 폴더(`C:\Users\k251110\Google Drive\gtvs-backups\`)에 두고 Google Drive 클라이언트가 자동 동기화
  - 30일 이상 된 백업은 자동 삭제
- SQLite는 단일 파일이라 백업은 단순 복사 (단, 진행 중 트랜잭션이 있으면 손상 가능 → `sqlite3 gtvs.db ".backup gtvs-YYYYMMDD.db"` 명령 사용 권장)
