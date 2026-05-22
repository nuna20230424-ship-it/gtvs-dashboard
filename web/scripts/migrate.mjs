// 마이그레이션 SQL 파일을 SQLite 에 적용 — `node scripts/migrate.mjs <migration.sql>`
// 컬럼이 이미 존재해도 idempotent 하게 동작하도록 "duplicate column name" 오류는 정상 종료로 처리
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// .env.local 직접 파싱 (의존성 없이) — DB_PATH 추출
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^"|"$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("usage: node scripts/migrate.mjs <path-to-sql>");
  process.exit(1);
}

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("DB_PATH env var required (예: .env.local 의 DB_PATH)");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(sqlPath), "utf-8");
const db = new Database(dbPath);

// 1) 라인 단위 주석(-- ...) 제거 → 2) 세미콜론 단위 분할 → 3) trim
const cleaned = sql
  .split(/\r?\n/)
  .map((line) => (line.trim().startsWith("--") ? "" : line))
  .join("\n");

const statements = cleaned
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  try {
    db.exec(stmt + ";");
    console.log("OK:", stmt.split("\n")[0].slice(0, 80));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("duplicate column name")) {
      console.log("SKIP (already applied):", stmt.split("\n")[0].slice(0, 80));
    } else {
      console.error("FAIL:", stmt);
      console.error(msg);
      process.exit(1);
    }
  }
}
db.close();
console.log("migration done");
