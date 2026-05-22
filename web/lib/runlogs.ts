// /updater 실행 이력을 파일 시스템(.runlogs)에 JSON으로 저장/조회 — DB 스키마 침범 회피
import "server-only";
import fs from "node:fs";
import path from "node:path";

export interface RunLog {
  startedAt: string; // ISO
  finishedAt: string | null;
  mode: "once" | "scheduler";
  exitCode: number | null;
  output: string; // stdout+stderr 합본, 64KB로 절단
  triggeredBy: string | null;
  pid: number | null;
  bat: string; // 실행한 bat 파일명
  error: string | null; // spawn 자체 실패 시 메시지
}

const LOG_DIR = path.join(process.cwd(), ".runlogs");

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function appendRunLog(log: RunLog): string {
  ensureDir();
  const ts = log.startedAt.replace(/[:.]/g, "-");
  const filename = `${ts}_${log.mode}.json`;
  const fullPath = path.join(LOG_DIR, filename);
  fs.writeFileSync(fullPath, JSON.stringify(log, null, 2), "utf-8");
  return filename;
}

export function countRunLogs(): number {
  ensureDir();
  return fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".json")).length;
}

export function clearRunLogs(): number {
  ensureDir();
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".json"));
  let deleted = 0;
  for (const f of files) {
    try {
      fs.unlinkSync(path.join(LOG_DIR, f));
      deleted += 1;
    } catch {
      // 파일 권한/잠금 이슈는 조용히 건너뜀 — 남은 파일은 다음 호출에서 재시도 가능
    }
  }
  return deleted;
}

export function listRecentRuns(limit: number): Array<RunLog & { file: string }> {
  ensureDir();
  const files = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit);

  const result: Array<RunLog & { file: string }> = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(LOG_DIR, f), "utf-8");
      const parsed = JSON.parse(raw) as Partial<RunLog>;
      // 구버전 로그 파일이 필드를 누락할 수 있어 안전한 기본값으로 정규화
      result.push({
        startedAt: parsed.startedAt ?? "",
        finishedAt: parsed.finishedAt ?? null,
        mode: parsed.mode ?? "once",
        exitCode: parsed.exitCode ?? null,
        output: parsed.output ?? "",
        triggeredBy: parsed.triggeredBy ?? null,
        pid: parsed.pid ?? null,
        bat: parsed.bat ?? "",
        error: parsed.error ?? null,
        file: f,
      });
    } catch {
      // 파손된 로그 파일은 조용히 건너뜀
    }
  }
  return result;
}
