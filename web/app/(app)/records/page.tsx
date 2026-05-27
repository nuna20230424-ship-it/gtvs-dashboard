// Records 페이지 — track 별 템플릿 (행=패키지, 단말별 서브 컬럼). 기본 track = beta
import { Fragment } from "react";
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { LiveClock } from "@/components/live-clock";
import { RecordsTemplateFilters } from "@/components/filters/records-template-filters";
import {
  listChangedCellsSinceReport,
  listChangedPackagesSinceReport,
  listPackageNames,
} from "@/lib/queries";
import { buildTemplate, type TemplateTrack } from "@/lib/template";
import { statusBadgeClass, trackBadgeClass } from "@/lib/format";
import { syncFromJsonl } from "@/lib/sync_jsonl";

// updater 실행 직후 즉시 새 데이터 반영 + 상단 시각이 매 요청 갱신되도록
export const dynamic = "force-dynamic";

interface SearchParams {
  track?: string;
  package?: string;
}

function resolveTrack(raw: string | undefined): TemplateTrack {
  return raw === "production" ? "production" : "beta";
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 스케줄러 백그라운드 실행분이 페이지 진입 시 즉시 반영되도록
  try {
    syncFromJsonl();
  } catch {
    // 동기화 실패해도 페이지 자체는 렌더해야 함
  }
  const session = await auth();
  const track = resolveTrack(searchParams.track);
  const result = buildTemplate(track, { package: searchParams.package });
  const allPackageNames = listPackageNames();
  const nowIso = new Date().toISOString();
  // 보고 윈도우(가장 최근 KST 09:00) 기반 TEST 대상 셀/패키지 — Overview 와 동일 기준
  const changedCells = listChangedCellsSinceReport();
  const changedPackages = listChangedPackagesSinceReport();

  const exportQuery = new URLSearchParams();
  exportQuery.set("track", track);
  if (searchParams.package) exportQuery.set("package", searchParams.package);

  const isBeta = track === "beta";
  // meta 헤더 셀 공통 — rowSpan=2 로 sub-header 줄에 걸치게
  const metaThClass =
    "border-l border-gray-200 px-3 py-2 text-left font-medium text-gray-600 align-middle";
  const firstMetaThClass =
    "sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600 align-middle";

  return (
    <>
      <Header title="Update Records" email={session?.user?.email ?? undefined} />
      <main className="flex-1 space-y-4 overflow-auto p-6">
        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3">
          <div className="text-sm text-gray-600">
            현재 시각{" "}
            <LiveClock
              initialIso={nowIso}
              className="ml-2 font-mono text-gray-900"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>현재 track</span>
            <Badge className={trackBadgeClass(track)}>{track}</Badge>
          </div>
        </div>

        <RecordsTemplateFilters packages={allPackageNames} />

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            활성 단말 {result.devices.length}대 · 패키지 {result.rows.length}개
          </div>
          <a
            href={`/api/export/records?${exportQuery.toString()}`}
            className="rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            {track} .xlsx 다운로드
          </a>
        </div>

        <div className="overflow-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th rowSpan={2} className={firstMetaThClass}>
                  App Name
                </th>
                <th rowSpan={2} className={metaThClass}>
                  {isBeta ? "Package" : "Package Name"}
                </th>
                {isBeta && (
                  <th rowSpan={2} className={metaThClass}>
                    Opt-In
                  </th>
                )}
                <th rowSpan={2} className={metaThClass}>
                  Ref
                </th>
                <th rowSpan={2} className={metaThClass}>
                  Latest version
                </th>
                <th rowSpan={2} className={metaThClass}>
                  {isBeta ? "Last update" : "Last Update"}
                </th>
                {isBeta ? (
                  <th rowSpan={2} className={metaThClass}>
                    Age (days)
                  </th>
                ) : (
                  <th rowSpan={2} className={metaThClass}>
                    Rollout Status
                  </th>
                )}
                {result.devices.map((d) => (
                  <th
                    key={d.id}
                    colSpan={3}
                    className="border-l border-gray-200 px-3 py-2 text-center font-semibold text-gray-800"
                  >
                    {d.model && d.model.trim() !== "" ? d.model : d.name}
                  </th>
                ))}
              </tr>
              {result.devices.length > 0 && (
                <tr className="border-t border-gray-200 text-xs text-gray-500">
                  {result.devices.map((d) => (
                    <Fragment key={d.id}>
                      <th className="border-l border-gray-200 px-3 py-1 text-left font-medium">
                        이전버전
                      </th>
                      <th className="border-l border-gray-200 px-3 py-1 text-left font-medium">
                        현재버전
                      </th>
                      <th className="border-l border-gray-200 px-3 py-1 text-left font-medium">
                        상태
                      </th>
                    </Fragment>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const p = r.package;
                return (
                  <tr key={p.id} className="border-t border-gray-200">
                    <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{p.app_name}</span>
                        {changedPackages.has(p.package) && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-900">
                            TEST
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-gray-200 px-3 py-2 align-top font-mono text-xs">
                      {p.package}
                    </td>
                    {isBeta && (
                      <td className="border-l border-gray-200 px-3 py-2 align-top text-xs">
                        {p.opt_in ?? "—"}
                      </td>
                    )}
                    <td className="border-l border-gray-200 px-3 py-2 align-top font-mono text-xs">
                      {p.ref ?? "—"}
                    </td>
                    <td className="border-l border-gray-200 px-3 py-2 align-top font-mono text-xs">
                      {r.latest_version ?? "—"}
                    </td>
                    <td className="border-l border-gray-200 px-3 py-2 align-top text-xs">
                      {r.last_update
                        ? isBeta
                          ? r.last_update.slice(0, 10)
                          : r.last_update.slice(0, 16).replace("T", " ")
                        : "—"}
                    </td>
                    {isBeta ? (
                      <td className="border-l border-gray-200 px-3 py-2 align-top text-xs">
                        {r.age_days ?? "—"}
                      </td>
                    ) : (
                      <td className="border-l border-gray-200 px-3 py-2 align-top text-xs">
                        {p.rollout_status ?? "—"}
                      </td>
                    )}
                    {result.devices.map((d) => {
                      const cell = r.per_device.get(d.name);
                      // 보고 윈도우 안에 (device, package) 가 변경됐는가 (Overview 와 동일 기준)
                      const updated = changedCells.has(`${d.name}::${p.package}`);
                      return (
                        <Fragment key={d.id}>
                          <td className="border-l border-gray-200 px-3 py-2 align-top font-mono text-xs">
                            {cell?.previous_version ?? "—"}
                          </td>
                          <td
                            className={`border-l border-gray-200 px-3 py-2 align-top font-mono text-xs ${
                              updated ? "bg-red-50" : ""
                            }`}
                          >
                            {cell?.current_version ? (
                              <span
                                className={
                                  updated
                                    ? "rounded bg-red-100 px-1 py-0.5 text-red-900"
                                    : ""
                                }
                              >
                                {cell.current_version}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="border-l border-gray-200 px-3 py-2 align-top">
                            {cell?.status ? (
                              <Badge className={statusBadgeClass(cell.status)}>
                                {cell.status}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}
              {result.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={(isBeta ? 7 : 6) + result.devices.length * 3}
                    className="px-3 py-8 text-center text-sm text-gray-500"
                  >
                    조회 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
