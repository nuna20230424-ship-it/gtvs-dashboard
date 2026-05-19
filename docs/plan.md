# GTVS Dashboard - 구현 계획

## 목표

GTVS 패키지(beta/production) 버전 업데이트 이력을 Supabase에 저장하고,
Next.js 웹앱 대시보드에서 조회·관리하며 향후 자동화 TC를 붙일 수 있는 메뉴를 제공한다.

## 기존 시스템 분석

- **위치**: `C:\Users\k251110\Desktop\qa-automation\gtvs_updater\`
- **실행**: Windows 작업 스케줄러(`GtvsUpdater_AM`, `GtvsUpdater_PM`) → `run_gtvs_updater_once.bat` → `python main.py --once`
- **데이터 구조** (`updater.py` `UpdateRecord` dataclass):
  - device, track(beta|production), app_name, package, ref, timestamp
  - status(updated|up_to_date|error), version_before, version_after, error
- **현재 저장처** (로컬 파일):
  - `update_history.jsonl` — 매 실행 기록(append)
  - `version_history.jsonl` — 버전 변경 이력
  - `version_snapshot.json` — 최신 버전 스냅샷
- **대상**: 단말 2대(STB-01 beta, STB-02 production), 패키지 18개

## 아키텍처

```
[gtvs_updater (Python)] --POST--> [Supabase (Postgres+Auth+REST)]
                                          ^
                                          | (PostgREST + RLS)
                                          |
                            [Next.js Dashboard (브라우저)]
```

- **DB/백엔드**: Supabase (Postgres + PostgREST + Auth)
- **프론트엔드**: Next.js 14 App Router + Tailwind + shadcn/ui
- **인증**: Supabase Auth (Email/Password)
- **통합**: Python에서 Supabase REST로 POST (service_role key는 .env에만 보관)

## 테이블 스키마

```sql
devices         (id, name PK, track, ip, port, active, created_at)
packages        (id, package PK, app_name, ref, active, created_at)
update_records  (id, device, track, package, ref, app_name,
                 status, version_before, version_after, error,
                 checked_at, created_at)
version_history (id, device, track, package, app_name,
                 version_before, version_after, source, changed_at,
                 created_at)
```

- `update_records`: 매 체크 실행마다 항목별 1행 (조회 기록)
- `version_history`: 실제 버전이 변한 경우만 기록 (이력)

## 대시보드 메뉴

1. **Overview** — 최신 버전 스냅샷 (단말×패키지 매트릭스, 마지막 체크 시각)
2. **Update Records** — 조회 기록 테이블
   - 컬럼: 조회시간, 단말(track), 패키지, 앱, ref, 이전버전, 현재버전, 상태, 에러
   - 필터: track(beta/production), 단말, 패키지, 상태, 날짜 범위
3. **Version History** — 버전 변경 이력
   - 컬럼: 변경시각, 단말(track), 패키지, 앱, 이전버전 → 현재버전, source(auto/manual)
4. **Tests** — 패키지별 테스트 메뉴 (placeholder, 향후 자동화 스크립트 연결)
   - 패키지 목록 + 단말 선택 + "Run Test" 버튼 (지금은 toast "준비 중")
5. **Settings** — devices/packages 관리(읽기 전용 표시 + 활성 토글)

## 에이전트 분담

- **Agent A (Backend)**: Supabase 스키마 SQL, RLS, 시드 데이터, REST 호출 예시
- **Agent B (Frontend)**: Next.js 14 프로젝트 셋업, Auth, 페이지/컴포넌트, 테스트 메뉴 UI
- **Agent C (Integration)**: `supabase_sink.py` 작성, `main.py`에 호출 추가, 실패 시 로컬 큐

## 작업 순서

1. 사용자가 Supabase 프로젝트 생성 → URL/anon/service_role key 수령 → `.env` 작성
2. Agent A/B/C 병렬 실행
3. 통합: 더미 데이터 → 대시보드 확인 → Python dry-run
4. 자체 테스트
