# GTVS Supabase 스키마

GTVS 대시보드용 Supabase(Postgres + PostgREST + Auth) 스키마와 시드 데이터 모음. 외부 마이그레이션 툴(supabase CLI) 없이 **SQL Editor 붙여넣기**로 운용한다.

## 디렉토리

```
supabase/
├── README.md                       # 이 문서
└── migrations/
    ├── 001_init.sql                # 테이블 4개 + 인덱스 + RLS
    └── 002_seed.sql                # devices 2건, packages 18건
```

## 적용 절차

1. Supabase Studio 좌측 메뉴에서 **SQL Editor** 진입.
2. `migrations/001_init.sql` 내용을 통째로 붙여넣고 **Run**.
3. 새 쿼리 탭에서 `migrations/002_seed.sql` 내용을 붙여넣고 **Run**.
4. 좌측 **Table Editor** 에서 `devices`(2행), `packages`(18행) 확인.

> 두 파일 모두 멱등하게 작성되어 있어 재실행해도 안전하다 (`if not exists`, `on conflict do nothing`, `drop policy if exists`).

## 테이블 요약

| 테이블 | 용도 | 쓰기 주체 |
| --- | --- | --- |
| `devices` | 단말 마스터 (STB-01/STB-02) | 시드 + 수동 |
| `packages` | 추적 패키지 마스터 (18종) | 시드 + 수동 |
| `update_records` | 매 체크 사이클의 조회 기록 | Python (`service_role`) |
| `version_history` | 버전이 실제로 변경된 이벤트 | Python (`service_role`) |

## RLS 동작 검증

### 1. 익명 키(anon)로 SELECT 가 막히는지 확인

대시보드는 로그인 사용자만 데이터를 보도록 설계했다. `anon` 으로는 빈 배열이 나와야 한다.

```bash
curl "https://<PROJECT>.supabase.co/rest/v1/devices?select=*" \
  -H "apikey: <ANON_KEY>"
# 기대 결과: []
```

### 2. 로그인 사용자(authenticated)로 SELECT 성공

```bash
curl "https://<PROJECT>.supabase.co/rest/v1/devices?select=*" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <USER_JWT>"
# 기대 결과: [{ "id": 1, "name": "STB-01", ... }, ...]
```

### 3. authenticated 가 update_records 에 INSERT 시도 시 거부

```bash
curl -X POST "https://<PROJECT>.supabase.co/rest/v1/update_records" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"device":"STB-01","track":"beta","package":"com.android.vending","status":"up_to_date","checked_at":"2026-05-19T10:00:00Z"}'
# 기대 결과: 401/403 (RLS 정책 위반)
```

### 4. service_role 로는 INSERT 성공

Python 워커는 `SUPABASE_SERVICE_ROLE_KEY` 를 사용한다.

```bash
curl -X POST "https://<PROJECT>.supabase.co/rest/v1/update_records" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"device":"STB-01","track":"beta","package":"com.android.vending","ref":"PlayStore","app_name":"PlayStore","status":"up_to_date","checked_at":"2026-05-19T10:00:00Z"}'
# 기대 결과: 201 + 생성된 행 JSON
```

## REST 호출 예시 (대시보드용)

### 최근 50건 조회 기록

```bash
curl "https://<PROJECT>.supabase.co/rest/v1/update_records?select=*&order=checked_at.desc&limit=50" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <USER_JWT>"
```

### 특정 단말/패키지의 버전 이력

```bash
curl "https://<PROJECT>.supabase.co/rest/v1/version_history?device=eq.STB-02&package=eq.com.google.android.youtube.tv&order=changed_at.desc" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <USER_JWT>"
```

### 현재 활성 패키지 목록

```bash
curl "https://<PROJECT>.supabase.co/rest/v1/packages?active=eq.true&select=package,app_name,ref&order=app_name.asc" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <USER_JWT>"
```

### active 토글 (authenticated UPDATE 허용)

```bash
curl -X PATCH "https://<PROJECT>.supabase.co/rest/v1/packages?package=eq.com.google.android.videos" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

## 인덱스 설계 메모

- `idx_update_records_checked_at` — 대시보드 메인의 "최근 조회" 타임라인용 정렬.
- `idx_update_records_device_package` — 단말+패키지별 상세 페이지의 시간순 조회.
- `idx_update_records_track_status` — `track=production AND status='error'` 류 필터링.
- `idx_version_history_changed_at` — 전체 변경 이벤트 피드.
- `idx_version_history_device_package` — 단말+패키지별 버전 변천사.
