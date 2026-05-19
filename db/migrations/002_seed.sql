-- GTVS 시드 데이터: 단말 2대, 패키지 18종 적재 (Supabase 원본과 동일)
-- 적용: psql ... -f 002_seed.sql (001_init.sql 적용 후 실행)

-- =============================================================================
-- devices (2건)
-- =============================================================================
insert into devices (name, track, ip, port) values
    ('STB-01', 'beta',       '172.30.1.128', 5555),
    ('STB-02', 'production', '172.30.1.129', 5555)
on conflict (name) do nothing;

-- =============================================================================
-- packages (18건) - config.yaml 의 순서를 그대로 유지
-- =============================================================================
insert into packages (package, app_name, ref) values
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
