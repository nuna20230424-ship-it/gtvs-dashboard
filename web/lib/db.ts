// SQLite 연결 싱글톤 (better-sqlite3). WAL 모드 보장, Hot reload 안전한 globalThis 캐시
import "server-only";
import Database from "better-sqlite3";

const DB_PATH = process.env.DB_PATH;
if (!DB_PATH) {
  throw new Error(
    "DB_PATH environment variable is required (예: .env.local 에 DB_PATH=C:/GTVS/dashboard/db/gtvs.db)"
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __gtvsDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const conn = new Database(DB_PATH!, { fileMustExist: true });
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  return conn;
}

export const db: Database.Database =
  globalThis.__gtvsDb ?? (globalThis.__gtvsDb = createDb());
