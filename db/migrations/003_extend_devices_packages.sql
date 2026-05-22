-- 003: devices.model + packages.opt_in / rollout_status 컬럼 추가
-- Overview의 STB 모델명 인풋, Records 템플릿의 Opt-In(beta) / Rollout Status(production) 표시용
-- SQLite ALTER TABLE ADD COLUMN: 디폴트 없이 추가하면 기존 행은 NULL — Python updater(positional INSERT 없음)와 양립

alter table devices add column model text;

alter table packages add column opt_in text;
alter table packages add column rollout_status text;
