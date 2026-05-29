-- Gemini 연동 부분 제거 (B 결정 2026-05-29) — 대시보드 측 캐시 테이블 삭제
-- P6 Python reporter 의 이메일 AI 요약만 유지 (urllib 자체 호출, 캐시 없음)

drop index if exists idx_gemini_cache_created_at;
drop table if exists gemini_cache;
