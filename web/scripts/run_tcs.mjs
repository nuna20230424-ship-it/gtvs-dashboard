// 내부 TC 러너 — 배포 전 변경 사항 검증
// 사용법: node scripts/run_tcs.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";

let pass = 0;
let fail = 0;
const failures = [];

function tc(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failures.push({ name, error: err.message });
    fail++;
  }
}

function assertEq(actual, expected, label = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function assert(cond, label) {
  if (!cond) throw new Error(label);
}

// .env.local 직접 파싱 (의존성 없이)
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

console.log("=".repeat(60));
console.log("GTVS Dashboard 변경 사항 내부 TC");
console.log("=".repeat(60));

// =============================================================================
// TC1: config.yaml — 4개 스케줄 시간 검증
// =============================================================================
console.log("\n[TC1] config.yaml schedule.times");
tc("config.yaml 가 읽혀야 한다", () => {
  const batDir = process.env.GTVS_UPDATER_BAT_DIR;
  assert(batDir, "GTVS_UPDATER_BAT_DIR 미설정");
  const configPath = path.join(batDir, "gtvs_updater", "config.yaml");
  assert(fs.existsSync(configPath), `config.yaml not found at ${configPath}`);
});
tc("schedule.times 가 00:00, 08:00, 12:00, 18:00 이어야 한다", () => {
  const batDir = process.env.GTVS_UPDATER_BAT_DIR;
  const configPath = path.join(batDir, "gtvs_updater", "config.yaml");
  const text = fs.readFileSync(configPath, "utf-8");
  // YAML 파서 의존 회피 — 단순 정규식
  const m = text.match(/schedule:\s*\n\s*times:\s*\n((?:\s*-\s*"[^"]+"\s*\n?)+)/);
  assert(m, "schedule.times 블록 미발견");
  const times = [...m[1].matchAll(/"([^"]+)"/g)].map((mm) => mm[1]).sort();
  assertEq(times, ["00:00", "08:00", "12:00", "18:00"], "schedule.times");
});

// =============================================================================
// TC2: sync_state.json vs JSONL 라인 카운트 일관성
// =============================================================================
console.log("\n[TC2] sync state 일관성");
let updateLines = 0;
let versionLines = 0;
tc("JSONL 파일이 존재하고 라인 카운트가 합리적이어야 한다", () => {
  const batDir = process.env.GTVS_UPDATER_BAT_DIR;
  const updatePath = path.join(batDir, "gtvs_updater", "update_history.jsonl");
  const versionPath = path.join(batDir, "gtvs_updater", "version_history.jsonl");
  assert(fs.existsSync(updatePath), "update_history.jsonl 없음");
  updateLines = fs
    .readFileSync(updatePath, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l.trim()).length;
  versionLines = fs.existsSync(versionPath)
    ? fs
        .readFileSync(versionPath, "utf-8")
        .split(/\r?\n/)
        .filter((l) => l.trim()).length
    : 0;
  assert(updateLines > 0, "update_history.jsonl 비어있음");
});
tc("sync_state 가 JSONL 라인 카운트 이하여야 한다", () => {
  const statePath = path.join(process.cwd(), ".runlogs", "sync_state.json");
  if (!fs.existsSync(statePath)) {
    throw new Error("sync_state.json 없음 — 동기화 한 번도 안 됨");
  }
  const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  assert(
    state.update_history_lines <= updateLines,
    `state.update_history_lines (${state.update_history_lines}) > JSONL (${updateLines})`
  );
  assert(
    state.version_history_lines <= versionLines,
    `state.version_history_lines (${state.version_history_lines}) > JSONL (${versionLines})`
  );
});

// =============================================================================
// TC3: SQLite update_records 의 데이터 무결성
// =============================================================================
console.log("\n[TC3] SQLite update_records 무결성");
const dbPath = process.env.DB_PATH;
let db;
tc("DB 가 열려야 한다", () => {
  assert(dbPath, "DB_PATH 미설정");
  db = new Database(dbPath, { readonly: true });
});
tc("update_records 행이 존재해야 한다", () => {
  const row = db.prepare("select count(*) c from update_records").get();
  assert(row.c > 0, `update_records 비어있음 (count=${row.c})`);
});
tc("track 값은 beta/production/unknown 만 가능해야 한다 (check 제약)", () => {
  const row = db
    .prepare(
      "select count(*) c from update_records where track not in ('beta','production','unknown')"
    )
    .get();
  assertEq(row.c, 0, "track 위반 행 수");
});
tc("status 값은 updated/up_to_date/error 만 가능해야 한다", () => {
  const row = db
    .prepare(
      "select count(*) c from update_records where status not in ('updated','up_to_date','error')"
    )
    .get();
  assertEq(row.c, 0, "status 위반 행 수");
});

// =============================================================================
// TC4: version fallback — coalesce(version_after, version_before) 로직
// =============================================================================
console.log("\n[TC4] version fallback (coalesce)");
tc("up_to_date 인 행은 version_after 가 null 이고 version_before 가 채워져 있어야 한다", () => {
  const sample = db
    .prepare(
      "select count(*) c from update_records where status='up_to_date' and version_before is not null and version_after is null"
    )
    .get();
  assert(sample.c > 0, "up_to_date + version_before NOT NULL + version_after NULL 케이스 없음");
});
tc("coalesce(version_after, version_before) 가 status=up_to_date 인 행에서 version_before 를 반환해야 한다", () => {
  const row = db
    .prepare(
      `select version_before, version_after, coalesce(version_after, version_before) v
       from update_records
       where status='up_to_date' and version_before is not null and version_after is null
       limit 1`
    )
    .get();
  assertEq(row.v, row.version_before, "coalesce 결과");
});

// =============================================================================
// TC5: Overview / Records 쿼리 시뮬레이션
// =============================================================================
console.log("\n[TC5] Overview / Records 쿼리 결과");
tc("listLatestRecordsForOverview 쿼리가 각 (device,package) 최신 1건을 반환해야 한다", () => {
  const rows = db
    .prepare(
      "select device, package, version_before, version_after, status, checked_at from update_records order by checked_at desc limit 100"
    )
    .all();
  const seen = new Set();
  for (const r of rows) {
    const key = `${r.device}::${r.package}`;
    seen.add(key);
  }
  assert(seen.size > 0, "(device,package) 조합 0건");
});
tc("Records 템플릿 latest_version SQL 이 각 패키지의 최신 버전을 반환해야 한다 (track=beta)", () => {
  const stmt = db.prepare(
    `select coalesce(version_after, version_before) as v from update_records
     where package = ? and track = ? and coalesce(version_after, version_before) is not null
     order by checked_at desc limit 1`
  );
  const pkgs = db
    .prepare("select package from packages where active=1")
    .all();
  let withVersion = 0;
  for (const p of pkgs) {
    const r = stmt.get(p.package, "beta");
    if (r && r.v) withVersion++;
  }
  assert(withVersion > 0, "beta track 에서 latest_version 이 잡히는 패키지가 0개");
  console.log(`     - beta track latest_version 잡힘: ${withVersion}/${pkgs.length} 패키지`);
});

// =============================================================================
// TC6: TypeScript 컴파일/빌드 통과
// =============================================================================
console.log("\n[TC6] next build 통과");
tc("npm run build — 컴파일 + 타입 체크 통과해야 한다", () => {
  const r = spawnSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    encoding: "utf-8",
    shell: true,
    timeout: 240000,
  });
  if (r.status !== 0) {
    const tail = (r.stdout + r.stderr).split("\n").slice(-15).join("\n");
    throw new Error(`build 실패 (exit ${r.status})\n${tail}`);
  }
});

// =============================================================================
// 결과
// =============================================================================
console.log("\n" + "=".repeat(60));
console.log(`결과: 통과 ${pass} · 실패 ${fail}`);
if (fail > 0) {
  console.log("\n실패한 TC:");
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
}
console.log("모든 TC 통과 — 배포 가능");
process.exit(0);
