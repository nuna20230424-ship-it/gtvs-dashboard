-- KT 리모컨 전체 키 동작 검증용 가상 패키지 entry
-- com.kt.androidtv (KT 런처) — STB에 이미 설치된 패키지. 시나리오만 추가.

insert into packages (package, app_name, ref, active, opt_in, rollout_status, test_supported)
values ('com.kt.androidtv', 'KT Launcher (리모컨)', 'KTRemote', 1, null, null, 1)
on conflict (package) do update set
  app_name = excluded.app_name,
  ref = excluded.ref,
  test_supported = 1;
