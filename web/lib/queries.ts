// SQLite 데이터 접근 레이어 — 페이지/액션/(향후)API Route 가 공유하는 쿼리 함수
import "server-only";
import { db } from "@/lib/db";
import { reportingWindowStartIso } from "@/lib/time";

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
  model: string | null;
}

export interface PackageRow {
  id: number;
  package: string;
  app_name: string;
  ref: string;
  active: boolean;
  opt_in: string | null;
  rollout_status: string | null;
  test_supported: boolean; // 0 = N/A (시나리오 미정의 또는 KT 단말 미지원)
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
  "device" | "package" | "version_before" | "version_after" | "status" | "checked_at"
>;

// =============================================================================
// devices / packages
// =============================================================================

type DeviceDb = Omit<DeviceRow, "active"> & { active: number };
type PackageDb = Omit<PackageRow, "active" | "test_supported"> & {
  active: number;
  test_supported: number;
};

function toPackageRow(r: PackageDb): PackageRow {
  return { ...r, active: !!r.active, test_supported: !!r.test_supported };
}

export function listActiveDevices(): DeviceRow[] {
  const rows = db
    .prepare(
      "select id, name, track, ip, port, active, model from devices where active = 1 order by track, name"
    )
    .all() as DeviceDb[];
  return rows.map((r) => ({ ...r, active: !!r.active }));
}

export function listActivePackages(): PackageRow[] {
  const rows = db
    .prepare(
      "select id, package, app_name, ref, active, opt_in, rollout_status, test_supported from packages where active = 1 order by package"
    )
    .all() as PackageDb[];
  return rows.map(toPackageRow);
}

export function listAllDevices(): DeviceRow[] {
  const rows = db
    .prepare(
      "select id, name, track, ip, port, active, model from devices order by track, name"
    )
    .all() as DeviceDb[];
  return rows.map((r) => ({ ...r, active: !!r.active }));
}

export function listAllPackages(): PackageRow[] {
  const rows = db
    .prepare(
      "select id, package, app_name, ref, active, opt_in, rollout_status, test_supported from packages order by package"
    )
    .all() as PackageDb[];
  return rows.map(toPackageRow);
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

// (device, package) 별 최신 1건만 SQL 측에서 추려서 반환 — Overview / Export 양쪽 사용
// 이전 구현: 최근 N건 가져와 JS Map 으로 dedup → 누적 데이터 늘수록 비례 비용
// 신규 구현: window function 으로 단말×패키지 수만큼만 반환 (인덱스 idx_update_records_dev_pkg_time 활용)
// limit 파라미터는 backward compat 위해 시그니처 유지 (현재는 무시)
export function listLatestRecordsForOverview(_limit: number): OverviewRow[] {
  void _limit;
  return db
    .prepare(
      `select device, package, version_before, version_after, status, checked_at
       from (
         select device, package, version_before, version_after, status, checked_at,
                row_number() over (partition by device, package order by checked_at desc) as rn
         from update_records
       )
       where rn = 1`
    )
    .all() as OverviewRow[];
}

// Overview 상단 배너용 — 모든 update_records 중 가장 최근 체크 시각
export function getLastCheckedAt(): string | null {
  const row = db
    .prepare("select max(checked_at) as last from update_records")
    .get() as { last: string | null } | undefined;
  return row?.last ?? null;
}

// Export API용 — 페이지네이션 없이 필터 조건 만족하는 전체 records
export function listAllRecords(filters: RecordsFilter): UpdateRecordRow[] {
  const { sql, params } = recordsWhere(filters);
  return db
    .prepare(
      `select id, device, track, package, ref, app_name, status, version_before, version_after, error, checked_at
       from update_records
       ${sql}
       order by checked_at desc`
    )
    .all(params) as UpdateRecordRow[];
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

// History 초기화 버튼용 — 필터 무관 전체 행 수
export function countAllHistory(): number {
  const row = db
    .prepare("select count(*) as c from version_history")
    .get() as { c: number };
  return row.c;
}

// 가장 최근 KST 09:00 이후 변경된 (device, package) pair 집합 — 등록 device·package 한정.
// Overview/Records 셀 빨강 판정 + Tests `?only=today` 활성 셀 판정에 공통 사용.
export function listChangedCellsSinceReport(): Set<string> {
  const since = reportingWindowStartIso();
  const rows = db
    .prepare(
      `select distinct device, package
       from version_history
       where changed_at >= @since
         and device in (select name from devices where active = 1)
         and package in (select package from packages where active = 1)`
    )
    .all({ since }) as Array<{ device: string; package: string }>;
  return new Set(rows.map((r) => `${r.device}::${r.package}`));
}

// 같은 윈도우 안에 어느 단말이든 변경된 package 집합 — Overview/Records 의 'TEST' 뱃지용
export function listChangedPackagesSinceReport(): Set<string> {
  const since = reportingWindowStartIso();
  const rows = db
    .prepare(
      `select distinct package
       from version_history
       where changed_at >= @since
         and device in (select name from devices where active = 1)
         and package in (select package from packages where active = 1)`
    )
    .all({ since }) as Array<{ package: string }>;
  return new Set(rows.map((r) => r.package));
}

// =============================================================================
// test_runs / manual_checks (Tests 페이지)
// =============================================================================

export interface TestRunLatest {
  id: number;
  device: string;
  package: string;
  scenario_id: string;
  result: string; // 'pass' | 'fail' | 'error' | 'skipped'
  reason: string | null;
  started_at: string;
  finished_at: string | null;
  log_excerpt: string | null;
  triggered_by: string;
  measurements: string | null;     // JSON 문자열 (사람 검증 보조)
  screenshot_path: string | null;  // 절대 경로 (API Route 가 응답)
}

export interface ManualCheckLatest {
  device: string;
  package: string;
  check_id: string;
  result: string; // 'pass' | 'fail' | 'skip'
  checker: string | null;
  checked_at: string;
  note: string | null;
}

// 활성 device × 활성 package 한정 — (device, package, scenario_id)별 최신 1건
export function listLatestTestRuns(): TestRunLatest[] {
  return db
    .prepare(
      `select id, device, package, scenario_id, result, reason, started_at, finished_at,
              log_excerpt, triggered_by, measurements, screenshot_path
       from (
         select id, device, package, scenario_id, result, reason, started_at, finished_at,
                log_excerpt, triggered_by, measurements, screenshot_path,
                row_number() over (partition by device, package, scenario_id order by started_at desc) rn
         from test_runs
         where device in (select name from devices where active = 1)
           and package in (select package from packages where active = 1)
       )
       where rn = 1`
    )
    .all() as TestRunLatest[];
}

// 활성 device × 활성 package 한정 — (device, package, check_id)별 최신 1건
export function listLatestManualChecks(): ManualCheckLatest[] {
  return db
    .prepare(
      `select device, package, check_id, result, checker, checked_at, note
       from (
         select device, package, check_id, result, checker, checked_at, note,
                row_number() over (partition by device, package, check_id order by checked_at desc) rn
         from manual_checks
         where device in (select name from devices where active = 1)
           and package in (select package from packages where active = 1)
       )
       where rn = 1`
    )
    .all() as ManualCheckLatest[];
}

// Export API용 — 페이지네이션 없이 필터 조건 만족하는 전체 history
export function listAllHistory(filters: HistoryFilter): VersionHistoryRow[] {
  const { sql, params } = historyWhere(filters);
  return db
    .prepare(
      `select id, device, track, package, app_name, version_before, version_after, source, changed_at
       from version_history
       ${sql}
       order by changed_at desc`
    )
    .all(params) as VersionHistoryRow[];
}
