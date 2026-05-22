// Python updater 가 쓰는 update_history.jsonl / version_history.jsonl 를 SQLite 로 동기화
// 라인 카운트 오프셋을 .runlogs/sync_state.json 에 저장해 중복 INSERT 방지
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

interface FileFingerprint {
  size: number;
  mtimeMs: number;
}

interface SyncState {
  update_history_lines: number;
  version_history_lines: number;
  // 파일 변경 여부 1차 판정용 — size/mtime 동일하면 readFile 전체 스킵
  update_history_fp?: FileFingerprint;
  version_history_fp?: FileFingerprint;
}

interface UpdateHistoryEntry {
  device: string;
  track: string;
  app_name: string;
  package: string;
  ref?: string;
  timestamp: string;
  status: string;
  version_before?: string | null;
  version_after?: string | null;
  error?: string | null;
}

interface VersionHistoryEntry {
  timestamp: string;
  device: string;
  track: string;
  package: string;
  app_name: string;
  version_before?: string | null;
  version_after: string;
  source: string;
}

const STATE_PATH = path.join(process.cwd(), ".runlogs", "sync_state.json");

function dataDir(): string {
  const explicit = process.env.GTVS_UPDATER_DATA_DIR;
  if (explicit) return explicit;
  const batDir = process.env.GTVS_UPDATER_BAT_DIR;
  if (!batDir) {
    throw new Error(
      "GTVS_UPDATER_DATA_DIR 또는 GTVS_UPDATER_BAT_DIR 가 .env.local 에 필요합니다"
    );
  }
  return path.join(batDir, "gtvs_updater");
}

function readState(): SyncState {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      update_history_lines: parsed.update_history_lines ?? 0,
      version_history_lines: parsed.version_history_lines ?? 0,
    };
  } catch {
    return { update_history_lines: 0, version_history_lines: 0 };
  }
}

function writeState(state: SyncState): void {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function readJsonlLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf-8");
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

// 파일 변경 1차 판정. 파일 없거나 stat 실패 시 null → 호출자는 "변경됨"으로 간주
function fingerprint(filePath: string): FileFingerprint | null {
  try {
    const s = fs.statSync(filePath);
    return { size: s.size, mtimeMs: s.mtimeMs };
  } catch {
    return null;
  }
}

function fpEqual(a: FileFingerprint | undefined, b: FileFingerprint | null): boolean {
  return !!a && !!b && a.size === b.size && a.mtimeMs === b.mtimeMs;
}

// SQLite check 제약 통과를 위해 track 값 정규화
function normalizeTrack(track: string, allowUnknown: boolean): string {
  if (track === "beta" || track === "production") return track;
  return allowUnknown ? "unknown" : "beta";
}

interface SyncResult {
  updateRecords: number;
  versionHistory: number;
  skipped: number;
  state: SyncState;
}

export function syncFromJsonl(): SyncResult {
  const dir = dataDir();
  const state = readState();

  const updatePath = path.join(dir, "update_history.jsonl");
  const versionPath = path.join(dir, "version_history.jsonl");

  let inserted_update = 0;
  let inserted_version = 0;
  let skipped = 0;

  // 파일이 마지막 sync 이후 변경되지 않았으면 비싼 readFile 자체를 건너뜀
  const updateFp = fingerprint(updatePath);
  const versionFp = fingerprint(versionPath);
  const updateUnchanged = fpEqual(state.update_history_fp, updateFp);
  const versionUnchanged = fpEqual(state.version_history_fp, versionFp);

  // update_history.jsonl → update_records
  const updateLines = updateUnchanged ? [] : readJsonlLines(updatePath);
  if (!updateUnchanged && updateLines.length > state.update_history_lines) {
    const newLines = updateLines.slice(state.update_history_lines);
    const insertUpdate = db.prepare(
      `insert into update_records
        (device, track, package, ref, app_name, status, version_before, version_after, error, checked_at)
       values
        (@device, @track, @package, @ref, @app_name, @status, @version_before, @version_after, @error, @checked_at)`
    );
    const txn = db.transaction((rows: UpdateHistoryEntry[]) => {
      for (const r of rows) {
        // manage_apps 는 의사 패키지 — 매트릭스 노출 부적합. 스킵.
        if (r.package === "manage_apps") {
          skipped++;
          continue;
        }
        // 통계로 잡힐 status 가 아니면 스킵 (check 제약 통과 보호)
        if (r.status !== "updated" && r.status !== "up_to_date" && r.status !== "error") {
          skipped++;
          continue;
        }
        try {
          insertUpdate.run({
            device: r.device,
            track: normalizeTrack(r.track, true),
            package: r.package,
            ref: r.ref ?? "",
            app_name: r.app_name ?? "",
            status: r.status,
            version_before: r.version_before ?? null,
            version_after: r.version_after ?? null,
            error: r.error ?? null,
            checked_at: r.timestamp,
          });
          inserted_update++;
        } catch {
          skipped++;
        }
      }
    });
    const parsed: UpdateHistoryEntry[] = [];
    for (const line of newLines) {
      try {
        parsed.push(JSON.parse(line) as UpdateHistoryEntry);
      } catch {
        skipped++;
      }
    }
    txn(parsed);
    state.update_history_lines = updateLines.length;
  }

  // version_history.jsonl → version_history
  const versionLines = versionUnchanged ? [] : readJsonlLines(versionPath);
  if (!versionUnchanged && versionLines.length > state.version_history_lines) {
    const newLines = versionLines.slice(state.version_history_lines);
    const insertVersion = db.prepare(
      `insert into version_history
        (device, track, package, app_name, version_before, version_after, source, changed_at)
       values
        (@device, @track, @package, @app_name, @version_before, @version_after, @source, @changed_at)`
    );
    const txn = db.transaction((rows: VersionHistoryEntry[]) => {
      for (const r of rows) {
        if (r.package === "manage_apps") {
          skipped++;
          continue;
        }
        if (r.source !== "auto" && r.source !== "manual") {
          skipped++;
          continue;
        }
        try {
          insertVersion.run({
            device: r.device,
            track: normalizeTrack(r.track, false),
            package: r.package,
            app_name: r.app_name ?? "",
            version_before: r.version_before ?? null,
            version_after: r.version_after,
            source: r.source,
            changed_at: r.timestamp,
          });
          inserted_version++;
        } catch {
          skipped++;
        }
      }
    });
    const parsed: VersionHistoryEntry[] = [];
    for (const line of newLines) {
      try {
        parsed.push(JSON.parse(line) as VersionHistoryEntry);
      } catch {
        skipped++;
      }
    }
    txn(parsed);
    state.version_history_lines = versionLines.length;
  }

  // fingerprint 는 매번 갱신 (변경 없어도 새로 stat 한 값으로 덮어쓰기 — 영구 보존 보장)
  if (updateFp) state.update_history_fp = updateFp;
  if (versionFp) state.version_history_fp = versionFp;

  writeState(state);

  return {
    updateRecords: inserted_update,
    versionHistory: inserted_version,
    skipped,
    state,
  };
}
