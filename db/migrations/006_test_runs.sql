-- 자동 시나리오 실행 결과(test_runs) + 수동 점검 응답(manual_checks) + packages.test_supported

-- 패키지 단위 테스트 지원 여부 (0 = N/A, 1 = 시나리오 있음)
alter table packages add column test_supported integer not null default 1;

-- README 18개 중 시나리오 미정의 4종 — 사용자 결정으로 N/A 처리
update packages set test_supported = 0 where package in (
  'com.google.android.trichromelibrary',  -- TrichromeLibrary
  'com.google.android.youtube.tvkids',    -- YouTube Kids
  'com.google.android.apps.tachyon',      -- Google Duo
  'com.google.android.videos'             -- Google Play Movies & TV
);

-- 자동 시나리오 step 실행 결과 — scenario_runner.py 가 INSERT
create table if not exists test_runs (
  id            integer primary key autoincrement,
  device        text not null,
  package       text not null,
  scenario_id   text not null,                 -- yaml auto_steps[].id
  started_at    text not null,
  finished_at   text,
  result        text not null,                 -- 'pass' | 'fail' | 'error'
  reason        text,                          -- assertion 미통과 사유 등
  log_excerpt   text,                          -- adb stdout/logcat 앞 2KB
  triggered_by  text not null                  -- 'auto' (gtvs_updater) | 'manual' (대시보드)
);

create index if not exists idx_test_runs_dev_pkg_time
  on test_runs (device, package, started_at desc);
create index if not exists idx_test_runs_pkg_scenario_time
  on test_runs (package, scenario_id, started_at desc);

-- 수동 점검 응답 — 대시보드에서 검증자가 체크
create table if not exists manual_checks (
  id          integer primary key autoincrement,
  device      text not null,
  package     text not null,
  check_id    text not null,                   -- yaml manual_checks[].id
  result      text not null,                   -- 'pass' | 'fail' | 'skip'
  checker     text,                            -- auth.email
  checked_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  note        text
);

create index if not exists idx_manual_checks_dev_pkg_time
  on manual_checks (device, package, checked_at desc);
create index if not exists idx_manual_checks_pkg_check_time
  on manual_checks (package, check_id, checked_at desc);

analyze;
