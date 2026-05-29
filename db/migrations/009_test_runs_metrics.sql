-- test_runs 에 측정값(JSON) + 스크린샷 경로 추가
-- PT17 — 자동화 신뢰도 보완: 사람이 의심 case 를 빠르게 검증할 수 있도록 측정값과 화면 근거 보존

alter table test_runs add column measurements text;     -- JSON: { opencv_motion: 5.2, audio_rms: 0.045, foreground_pkg: ... }
alter table test_runs add column screenshot_path text;  -- 절대 경로 (qa-automation/.runlogs/screens/...)
