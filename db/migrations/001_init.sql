-- 노트북 단독 운영용 SQLite 초기 스키마 (gtvs.db)
-- 적용: sqlite3 C:\GTVS\dashboard\db\gtvs.db ".read 001_init.sql"
-- Postgres 호환판은 db/migrations/postgres/001_init.sql 참조 (폐기됨)

-- SQLite WAL 모드 — Python sink INSERT 와 Next.js SELECT 동시 접근 안전성 확보
pragma journal_mode = wal;
pragma synchronous  = normal;
pragma foreign_keys = on;

-- =============================================================================
-- 1. devices : 단말 마스터 테이블
--    name=STB 식별자, track=beta|production, ip/port=adb 대상
-- =============================================================================
create table if not exists devices (
    id          integer primary key autoincrement,
    name        text    not null unique,
    track       text    not null check (track in ('beta', 'production')),
    ip          text    not null,
    port        integer not null default 5555,
    active      integer not null default 1 check (active in (0, 1)),
    created_at  text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- =============================================================================
-- 2. packages : 추적 대상 패키지 마스터 (18종)
-- =============================================================================
create table if not exists packages (
    id          integer primary key autoincrement,
    package     text    not null unique,
    app_name    text    not null,
    ref         text    not null,
    active      integer not null default 1 check (active in (0, 1)),
    created_at  text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- =============================================================================
-- 3. update_records : 매 체크 사이클마다 단말×패키지 조합당 1행
--    status=updated|up_to_date|error, checked_at=ISO8601 UTC
-- =============================================================================
create table if not exists update_records (
    id              integer primary key autoincrement,
    device          text    not null,
    track           text    not null check (track in ('beta', 'production', 'unknown')),
    package         text    not null,
    ref             text    not null default '',
    app_name        text    not null default '',
    status          text    not null check (status in ('updated', 'up_to_date', 'error')),
    version_before  text,
    version_after   text,
    error           text,
    checked_at      text    not null,
    created_at      text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_update_records_checked_at
    on update_records (checked_at desc);

create index if not exists idx_update_records_device_package
    on update_records (device, package, checked_at desc);

create index if not exists idx_update_records_track_status
    on update_records (track, status);

-- =============================================================================
-- 4. version_history : 버전이 실제로 변경된 이벤트만 1행
--    source=auto|manual, changed_at=ISO8601 UTC
-- =============================================================================
create table if not exists version_history (
    id              integer primary key autoincrement,
    device          text    not null,
    track           text    not null,
    package         text    not null,
    app_name        text    not null default '',
    version_before  text,
    version_after   text    not null,
    source          text    not null check (source in ('auto', 'manual')),
    changed_at      text    not null,
    created_at      text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_version_history_changed_at
    on version_history (changed_at desc);

create index if not exists idx_version_history_device_package
    on version_history (device, package, changed_at desc);

-- =============================================================================
-- 5. users : 대시보드 로그인 사용자 (NextAuth Credentials Provider)
--    password_hash = bcrypt
-- =============================================================================
create table if not exists users (
    id              integer primary key autoincrement,
    email           text    not null unique,
    password_hash   text    not null,
    display_name    text,
    created_at      text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
