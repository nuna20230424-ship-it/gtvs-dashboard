-- KT 단말 미지원 패키지 N/A 처리 (TV Launcher / Google TV Home)
-- STB-01, STB-02 모두 KT 단말이라 두 패키지의 자동 시나리오는 의미 없음

update packages set test_supported = 0 where package in (
  'com.google.android.tvlauncher',         -- TV Launcher (TvHome)
  'com.google.android.apps.tv.launcherx'   -- Google TV Home (LauncherX)
);
