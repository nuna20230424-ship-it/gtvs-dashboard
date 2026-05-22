-- update_records / version_history 조회 핫패스 인덱스
-- 매 페이지 진입마다 비용 큰 정렬/필터 제거 (force-dynamic 환경에서 효과 큼)

-- Overview: (device, package) 최신 1건 lookup → device+package+checked_at desc
create index if not exists idx_update_records_dev_pkg_time
  on update_records (device, package, checked_at desc);

-- Records 템플릿: (package, track) 최신, (device, package, track) 최신
create index if not exists idx_update_records_pkg_track_time
  on update_records (package, track, checked_at desc);
create index if not exists idx_update_records_dev_pkg_track_time
  on update_records (device, package, track, checked_at desc);

-- Overview 배너 max(checked_at), Records 페이지 단순 정렬
create index if not exists idx_update_records_time
  on update_records (checked_at desc);

-- History 페이지: changed_at 정렬 + (package, track) 최근
create index if not exists idx_version_history_time
  on version_history (changed_at desc);
create index if not exists idx_version_history_pkg_track_time
  on version_history (package, track, changed_at desc);

-- History 필터별 (track / device / package / source) 단일 컬럼 보조 인덱스
create index if not exists idx_version_history_track on version_history (track);
create index if not exists idx_version_history_device on version_history (device);
create index if not exists idx_version_history_package on version_history (package);
create index if not exists idx_version_history_source on version_history (source);

-- 쿼리 플래너가 신규 인덱스 활용하도록 통계 갱신
analyze;
