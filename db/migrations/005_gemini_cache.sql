-- Gemini API 응답 캐시 — 무료 한도(2.5 Flash 250 req/day) 보호용
-- 같은 (model, prompt) 조합이면 캐시된 응답을 그대로 반환해 API 호출을 회피

create table if not exists gemini_cache (
  input_hash text primary key,        -- sha256(model || '\n' || prompt)
  model      text not null,
  output     text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists idx_gemini_cache_created_at
  on gemini_cache (created_at desc);
