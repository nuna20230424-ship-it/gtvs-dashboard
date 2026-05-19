// SQLite 데이터 접근 레이어 — 페이지/액션/(향후)API Route 가 공유하는 쿼리 함수
import "server-only";
import { db } from "@/lib/db";

// =============================================================================
// 타입 정의 (페이지/액션/필터 컴포넌트 공통 import)
// =============================================================================

export interface DeviceRow {
  id: number;
  name: string;
  track: string;
  ip: string;
  port: number;
  active: boolean;
}

export interface PackageRow {
  id: number;
  package: string;
  app_name: string;
  ref: string;
  active: boolean;
}

export interface UpdateRecordRow {
  id: number;
  device: string;
  track: string;
  package: string;
  ref: string;
  app_name: string;
  status: string;
  version_before: string | null;
  version_after: string | null;
  error: string | null;
  checked_at: string;
}

export interface VersionHistoryRow {
  id: number;
  device: string;
  track: string;
  package: string;
  app_name: string;
  version_before: string | null;
  version_after: string;
  source: string;
  changed_at: string;
}

export interface RecordsFilter {
  track?: string;
  device?: string;
  package?: string;
  status?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD (inclusive — 내부에서 T23:59:59 으로 확장)
}

export interface HistoryFilter {
  track?: string;
  device?: string;
  package?: string;
  source?: string;
  from?: string;
  to?: string;
}

export interface Pagination {
  offset: number;
  limit: number;
}

export type OverviewRow = Pick<
  UpdateRecordRow,
  "device" | "package" | "version_after" | "status" | "checked_at"
>;

// =============================================================================
// devices / packages
// =============================================================================

type DeviceDb = Omit<DeviceRow, "active"> & { active: number };
type PackageDb = Omit<PackageRow, "active"> & { active: number };

export function listActiveDevices(): DeviceRow[] {
  const rows = db
    .prepare(
      "select id, name, track, ip, port, active from devices where active = 1 order by track, name"
    )
    .all() as DeviceDb[];
  return rows.map((r) => ({ ...r, active: !!r.active }));
}

export function listActivePackages(): PackageRow[] {
  const rows = db
    .prepare(
      "select id, package, app_name, ref, active from packages where active = 1 order by package"
    )
    .all() as PackageDb[];
  return rows.map((r) => ({ ...r, active: !!r.active }));
}

export function listAllDevices(): DeviceRow[] {
  const rows = db
    .prepare(
      "select id, name, track, ip, port, active from devices order by track, name"
    )
    .all() as DeviceDb[];
  return rows.map((r) => ({ ...r, active: !!r.active }));
}

export function listAllPackages(): PackageRow[] {
  const rows = db
    .prepare(
      "select id, package, app_name, ref, active from packages order by package"
    )
    .all() as PackageDb[];
  return rows.map((r) => ({ ...r, active: !!r.active }));
}

export function listDeviceNames(): string[] {
  const rows = db
    .prepare("select name from devices order by name")
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export function listPackageNames(): string[] {
  const rows = db
    .prepare("select package from packages order by package")
    .all() as Array<{ package: string }>;
  return rows.map((r) => r.package);
}

// =============================================================================
// update_records (Records 페이지 + Overview)
// =============================================================================

function recordsWhere(f: RecordsFilter): {
  sql: string;
  params: Record<string, unknown>;
} {
  const cond: string[] = [];
  const params: Record<string, unknown> = {};
  if (f.track) {
    cond.push("track = @track");
    params.track = f.track;
  }
  if (f.device) {
    cond.push("device = @device");
    params.device = f.device;
  }
  if (f.package) {
    cond.push("package = @package");
    params.package = f.package;
  }
  if (f.status) {
    cond.push("status = @status");
    params.status = f.status;
  }
  if (f.from) {
    cond.push("checked_at >= @from");
    params.from = f.from;
  }
  if (f.to) {
    cond.push("checked_at <= @to_inclusive");
    params.to_inclusive = `${f.to}T23:59:59`;
  }
  return {
    sql: cond.length ? `where ${cond.join(" and ")}` : "",
    params,
  };
}

export function listRecords(
  filters: RecordsFilter,
  pagination: Pagination
): { rows: UpdateRecordRow[]; count: number } {
  const { sql, params } = recordsWhere(filters);
  const rows = db
    .prepare(
      `select id, device, track, package, ref, app_name, status, version_before, version_after, error, checked_at
       from update_records
       ${sql}
       order by checked_at desc
       limit @limit offset @offset`
    )
    .all({ ...params, limit: pagination.limit, offset: pagination.offset }) as UpdateRecordRow[];

  const countRow = db
    .prepare(`select count(*) as c from update_records ${sql}`)
    .get(params) as { c: number };

  return { rows, count: countRow.c };
}

export function listLatestRecordsForOverview(limit: number): OverviewRow[] {
  return db
    .prepare(
      "select device, package, version_after, status, checked_at from update_records order by checked_at desc limit ?"
    )
    .all(limit) as OverviewRow[];
}

// =============================================================================
// version_history (History 페이지)
// =============================================================================

function historyWhere(f: HistoryFilter): {
  sql: string;
  params: Record<string, unknown>;
} {
  const cond: string[] = [];
  const params: Record<string, unknown> = {};
  if (f.track) {
    cond.push("track = @track");
    params.track = f.track;
  }
  if (f.device) {
    cond.push("device = @device");
    params.device = f.device;
  }
  if (f.package) {
    cond.push("package = @package");
    params.package = f.package;
  }
  if (f.source) {
    cond.push("source = @source");
    params.source = f.source;
  }
  if (f.from) {
    cond.push("changed_at >= @from");
    params.from = f.from;
  }
  if (f.to) {
    cond.push("changed_at <= @to_inclusive");
    params.to_inclusive = `${f.to}T23:59:59`;
  }
  return {
    sql: cond.length ? `where ${cond.join(" and ")}` : "",
    params,
  };
}

export function listHistory(
  filters: HistoryFilter,
  pagination: Pagination
): { rows: VersionHistoryRow[]; count: number } {
  const { sql, params } = historyWhere(filters);
  const rows = db
    .prepare(
      `select id, device, track, package, app_name, version_before, version_after, source, changed_at
       from version_history
       ${sql}
       order by changed_at desc
       limit @limit offset @offset`
    )
    .all({ ...params, limit: pagination.limit, offset: pagination.offset }) as VersionHistoryRow[];

  const countRow = db
    .prepare(`select count(*) as c from version_history ${sql}`)
    .get(params) as { c: number };

  return { rows, count: countRow.c };
}
