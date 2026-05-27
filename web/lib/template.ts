// Records 페이지 신규 템플릿 데이터 빌더 — 행=패키지, 열=track 메타 + 단말별 (이전/현재/상태)
import "server-only";
import { db } from "@/lib/db";
import type { DeviceRow, PackageRow } from "@/lib/queries";

export type TemplateTrack = "beta" | "production";

export interface PerDeviceCell {
  // 직전 업데이트 이벤트의 version_before (version_history 기반).
  // update_records.version_before 는 status=up_to_date 시 '현재 버전' 을 가리키므로
  // "이전버전" 컬럼에 그대로 쓰면 안 됨 — 항상 version_history 의 값을 사용.
  previous_version: string | null;
  current_version: string | null;
  status: string | null;
}

export interface TemplateRow {
  package: PackageRow;
  latest_version: string | null;
  last_update: string | null; // ISO timestamp
  age_days: number | null;
  per_device: Map<string, PerDeviceCell>; // key: device name
}

export interface TemplateResult {
  track: TemplateTrack;
  devices: DeviceRow[]; // 해당 track 의 active 단말
  rows: TemplateRow[];
}

export interface TemplateFilter {
  package?: string;
}

// 단일 패키지 필터(있으면)만 적용. 향후 필요 시 확장
export function buildTemplate(
  track: TemplateTrack,
  filter: TemplateFilter
): TemplateResult {
  const devices = db
    .prepare(
      "select id, name, track, ip, port, active, model from devices where active = 1 and track = ? order by name"
    )
    .all(track) as Array<Omit<DeviceRow, "active"> & { active: number }>;

  const devicesTyped: DeviceRow[] = devices.map((d) => ({
    ...d,
    active: !!d.active,
  }));

  let packageWhere = "where active = 1";
  const packageParams: unknown[] = [];
  if (filter.package) {
    packageWhere += " and package = ?";
    packageParams.push(filter.package);
  }

  const packages = db
    .prepare(
      `select id, package, app_name, ref, active, opt_in, rollout_status
       from packages
       ${packageWhere}
       order by app_name`
    )
    .all(...packageParams) as Array<Omit<PackageRow, "active"> & { active: number }>;

  const packagesTyped: PackageRow[] = packages.map((p) => ({
    ...p,
    active: !!p.active,
  }));

  // 패키지별 Latest version + Last update — track 전체 단말 통합 가장 최근 기록의 현재 버전
  // status=up_to_date 일 때 Python 은 version_after 를 null 로 두므로 version_before fallback 필요
  const latestVersionStmt = db.prepare(
    `select coalesce(version_after, version_before) as version_after from update_records
     where package = ? and track = ? and coalesce(version_after, version_before) is not null
     order by checked_at desc limit 1`
  );
  const lastUpdateStmt = db.prepare(
    `select changed_at from version_history
     where package = ? and track = ?
     order by changed_at desc limit 1`
  );

  // 단말×패키지별 최신 1건 — 현재 버전·상태용
  const perDeviceStmt = db.prepare(
    `select version_before, version_after, status from update_records
     where device = ? and package = ? and track = ?
     order by checked_at desc limit 1`
  );

  // 단말×패키지별 가장 최근 업데이트 이벤트의 version_before — "이전버전" 정답값
  const previousVersionStmt = db.prepare(
    `select version_before from version_history
     where device = ? and package = ? and track = ?
     order by changed_at desc limit 1`
  );

  const now = Date.now();
  const rows: TemplateRow[] = packagesTyped.map((p) => {
    const lv = latestVersionStmt.get(p.package, track) as
      | { version_after: string | null }
      | undefined;
    const lu = lastUpdateStmt.get(p.package, track) as
      | { changed_at: string }
      | undefined;

    const last_update = lu?.changed_at ?? null;
    let age_days: number | null = null;
    if (last_update) {
      const t = new Date(last_update).getTime();
      if (!Number.isNaN(t)) {
        age_days = Math.floor((now - t) / 86_400_000);
      }
    }

    const per_device = new Map<string, PerDeviceCell>();
    for (const d of devicesTyped) {
      const rec = perDeviceStmt.get(d.name, p.package, track) as
        | { version_before: string | null; version_after: string | null; status: string | null }
        | undefined;
      const prev = previousVersionStmt.get(d.name, p.package, track) as
        | { version_before: string | null }
        | undefined;
      // 현재 버전 — status=up_to_date 일 땐 version_after=null 이라 version_before 가 현재값
      const current_version = rec ? (rec.version_after ?? rec.version_before) : null;
      per_device.set(d.name, {
        previous_version: prev?.version_before ?? null,
        current_version,
        status: rec?.status ?? null,
      });
    }

    return {
      package: p,
      latest_version: lv?.version_after ?? null,
      last_update,
      age_days,
      per_device,
    };
  });

  return { track, devices: devicesTyped, rows };
}
