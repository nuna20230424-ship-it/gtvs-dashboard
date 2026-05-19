// 초기 대시보드 사용자 등록 — users 테이블에 bcrypt 해시로 INSERT
// 사용 예: node --env-file=.env.local scripts/create_user.mjs admin@kaongroup.com mypassword "관리자"
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const [, , emailArg, password, displayName] = process.argv;
if (!emailArg || !password) {
  console.error(
    "Usage: node --env-file=.env.local scripts/create_user.mjs <email> <password> [<display_name>]"
  );
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH;
if (!DB_PATH) {
  console.error("DB_PATH env var required (.env.local 누락 또는 --env-file 옵션 미사용)");
  process.exit(1);
}

const email = emailArg.toLowerCase().trim();
const conn = new Database(DB_PATH, { fileMustExist: true });
const hashed = await bcrypt.hash(password, 10);

try {
  const result = conn
    .prepare(
      "insert into users (email, password_hash, display_name) values (?, ?, ?)"
    )
    .run(email, hashed, displayName ?? null);
  console.log(`User created: id=${result.lastInsertRowid}, email=${email}`);
} catch (err) {
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
    console.error(`Email already exists: ${email}`);
    process.exit(1);
  }
  throw err;
} finally {
  conn.close();
}
