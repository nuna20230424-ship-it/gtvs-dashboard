-- GTVS 시드 데이터: config.yaml 의 단말 2대, 패키지 18종을 그대로 적재
-- 001_init.sql 실행 후에 SQL Editor 에서 실행한다.

-- =============================================================================
-- devices (2건)
-- =============================================================================
insert into public.devices (name, track, ip, port) values
    ('STB-01', 'beta',       '172.30.1.128', 5555),
    ('STB-02', 'production', '172.30.1.129', 5555)
on conflict (name) do nothing;

-- =============================================================================
-- packages (18건) - config.yaml 의 순서를 그대로 유지
-- =============================================================================
insert into public.packages (package, app_name, ref) values
    ('com.google.android.gms',                   'Google Play services',         'GmsCore'),
    ('com.google.android.webview',               'Android System WebView',       'WebViewGoogle'),
    ('com.google.android.tvlauncher',            'TV Launcher',                  'TvHome'),
    ('com.android.vending',                      'PlayStore',                    'PlayStore'),
    ('com.google.android.trichromelibrary',      'TrichromeLibrary',             'TriChromeLibrary'),
    ('com.google.android.tungsten.setupwraith',  'TV Setup',                     'SetupWraith'),
    ('com.google.android.apps.tv.launcherx',     'Google TV Home',               'LauncherX'),
    ('com.google.android.katniss',               'Assistant',                    'Katniss'),
    ('com.google.android.tv.remote.service',     'Android TV Remote Service',    'RemoteService'),
    ('com.google.android.apps.mediashell',       'Google Cast',                  'MediaShell'),
    ('com.google.android.backdrop',              'Backdrop',                     'Backdrop'),
    ('com.google.android.marvin.talkback',       'Android Accessibility Suite',  'talkback'),
    ('com.google.android.inputmethod.latin',     'Gboard',                       'LatinImeGoogle'),
    ('com.google.android.youtube.tv',            'YouTube',                      'YouTube'),
    ('com.google.android.tvrecommendations',     'TV Core Services',             'TvCoreServices'),
    ('com.google.android.youtube.tvkids',        'YouTube Kids',                 'YouTubeKids'),
    ('com.google.android.apps.tachyon',          'Google Duo',                   'Duo'),
    ('com.google.android.videos',                'Google Play Movies & TV',      'PlayMovies')
on conflict (package) do nothing;
