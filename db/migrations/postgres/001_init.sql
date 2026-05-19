-- Mac mini Postgres용 GTVS 대시보드 초기 스키마 (RLS 없음, Supabase 의존 제거)
-- 적용: psql "postgres://gtvs_app:비밀번호@호스트:5432/gtvs" -f 001_init.sql

-- =============================================================================
-- 1. devices : 단말 마스터 테이블
-- =============================================================================
create table if not exists public.devices (
    id          bigserial primary key,
    name        text        not null unique,
    track       text        not null check (track in ('beta', 'production')),
    ip          text        not null,
    port        int         not null default 5555,
    active      boolean     not null default true,
    created_at  timestamptz not null default now()
);

comment on table  public.devices         is 'GTVS 대상 단말 마스터 (STB-01 beta / STB-02 production)';
comment on column public.devices.name    is '단말 식별자 (예: STB-01)';
comment on column public.devices.track   is '트랙 구분: beta 또는 production';
comment on column public.devices.ip      is 'adb connect 대상 IP';
comment on column public.devices.active  is '대시보드 노출 여부 토글';

-- =============================================================================
-- 2. packages : 패키지 마스터 테이블
-- =============================================================================
create table if not exists public.packages (
    id          bigserial primary key,
    package     text        not null unique,
    app_name    text        not null,
    ref         text        not null,
    active      boolean     not null default true,
    created_at  timestamptz not null default now()
);

comment on table  public.packages          is '추적 대상 Play Store 패키지 마스터 (18종)';
comment on column public.packages.package  is 'Android 패키지명 (예: com.google.android.gms)';
comment on column public.packages.app_name is 'Play Store 상의 앱 이름';
comment on column public.packages.ref      is 'apkmirror 등에서 사용하는 패키지 별칭';
comment on column public.packages.active   is '추적 대상 여부 토글';

-- =============================================================================
-- 3. update_records : 매 체크마다 1행 (조회/업데이트 시도 기록)
-- =============================================================================
create table if not exists public.update_records (
    id              bigserial primary key,
    device          text        not null,
    track           text        not null check (track in ('beta', 'production', 'unknown')),
    package         text        not null,
    ref             text        not null default '',
    app_name        text        not null default '',
    status          text        not null check (status in ('updated', 'up_to_date', 'error')),
    version_before  text,
    version_after   text,
    error           text,
    checked_at      timestamptz not null,
    created_at      timestamptz not null default now()
);

comment on table  public.update_records              is '매 체크 사이클마다 단말×패키지 조합당 1행 기록';
comment on column public.update_records.status       is 'updated: 버전 변경, up_to_date: 동일, error: 실패';
comment on column public.update_records.checked_at   is 'Python 측에서 체크를 수행한 시각 (UpdateRecord.timestamp)';

-- update_records 인덱스
create index if not exists idx_update_records_checked_at
    on public.update_records (checked_at desc);

create index if not exists idx_update_records_device_package
    on public.update_records (device, package, checked_at desc);

create index if not exists idx_update_records_track_status
    on public.update_records (track, status);

-- =============================================================================
-- 4. version_history : 실제 버전이 변경된 경우만 1행
-- =============================================================================
create table if not exists public.version_history (
    id              bigserial primary key,
    device          text        not null,
    track           text        not null,
    package         text        not null,
    app_name        text        not null default '',
    version_before  text,
    version_after   text        not null,
    source          text        not null check (source in ('auto', 'manual')),
    changed_at      timestamptz not null,
    created_at      timestamptz not null default now()
);

comment on table  public.version_history            is '버전이 실제로 바뀐 이벤트만 기록 (version_history.jsonl 미러)';
comment on column public.version_history.source     is 'auto: 스케줄러, manual: 사용자 수동 트리거';
comment on column public.version_history.changed_at is '버전 변경이 감지된 시각';

-- version_history 인덱스
create index if not exists idx_version_history_changed_at
    on public.version_history (changed_at desc);

create index if not exists idx_version_history_device_package
    on public.version_history (device, package, changed_at desc);

-- =============================================================================
-- 5. users : 대시보드 로그인 사용자 (NextAuth Credentials Provider용)
-- =============================================================================
create table if not exists public.users (
    id              bigserial primary key,
    email           text        not null unique,
    password_hash   text        not null,
    display_name    text,
    created_at      timestamptz not null default now()
);

comment on table  public.users               is 'NextAuth Credentials Provider 로그인 사용자';
comment on column public.users.password_hash is 'bcrypt 해시';
