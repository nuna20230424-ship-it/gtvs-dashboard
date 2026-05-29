// Overview 페이지 — 패키지 × 단말 최신 버전 매트릭스 (행=패키지, 열=단말)
import React from "react";
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { OverviewModelCell } from "./overview-model-cell";
import {
  getLastCheckedAt,
  listActiveDevices,
  listActivePackages,
  listChangedCellsSinceReport,
  listChangedPackagesSinceReport,
  listLatestRecordsForOverview,
  type OverviewRow,
} from "@/lib/queries";
import {
  formatDateTime,
  statusBadgeClass,
  trackBadgeClass,
} from "@/lib/format";
import { syncFromJsonl } from "@/lib/sync_jsonl";
import { reportingWindowStartIso } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  try {
    syncFromJsonl();
  } catch {
    // 동기화 실패해도 페이지 자체는 그려야 함
  }
  const session = await auth();
  const deviceList = listActiveDevices();
  const packageList = listActivePackages();
  const recordList = listLatestRecordsForOverview(2000);
  const lastCheckedAt = getLastCheckedAt();
  const changedCells = listChangedCellsSinceReport();
  const changedPackages = listChangedPackagesSinceReport();
  const windowStart = reportingWindowStartIso();

  const latest = new Map<string, OverviewRow>();
  for (const r of recordList) {
    const key = `${r.device}::${r.package}`;
    if (!latest.has(key)) latest.set(key, r);
  }

  return (
    <>
      <Header title="Overview" email={session?.user?.email ?? undefined} />
      <main className="flex-1 space-y-4 overflow-auto p-6">
        {/* 상단 정보 바 */}
        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600">
            <span>
              Updater 마지막 실행 시각
              <span className="ml-2 font-mono text-gray-900">
                {lastCheckedAt ? formatDateTime(lastCheckedAt) : "기록 없음"}
              </span>
            </span>
            <span className="text-gray-300">·</span>
            <span>
              TEST 보고 윈도우
              <span className="ml-2 font-mono text-gray-900">
                {formatDateTime(windowStart)} ~
              </span>
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-900">
                {changedCells.size}개 셀
              </span>
            </span>
          </div>
          <a
            href="/api/export/overview"
            className="rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800"
          >
            Overview .xlsx
          </a>
        </div>

        {/* 매트릭스 테이블 */}
        <div className="overflow-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              {/* 1행: 패키지/단말 헤더 — 단말명은 버전+시간 묶음으로 colspan=2 */}
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600 align-bottom"
                >
                  패키지 / 단말
                </th>
                {deviceList.map((d) => (
                  <th
                    key={d.id}
                    colSpan={2}
                    className="border-b border-l border-gray-200 px-3 py-2 text-left font-medium text-gray-600"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {d.model && d.model.trim() !== "" ? d.model : d.name}
                        </span>
                        <Badge className={trackBadgeClass(d.track)}>
                          {d.track}
                        </Badge>
                      </div>
                      <OverviewModelCell id={d.id} initial={d.model} />
                    </div>
                  </th>
                ))}
              </tr>
              {/* 2행: 버전 / 업데이트 시간 서브 헤더 */}
              <tr>
                {deviceList.map((d) => (
                  <React.Fragment key={d.id}>
                    <th className="border-l border-t border-gray-200 px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 whitespace-nowrap">
                      버전
                    </th>
                    <th className="border-l border-t border-gray-200 px-3 py-1.5 text-left text-[11px] font-medium text-gray-500 whitespace-nowrap">
                      업데이트 시간
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {packageList.map((p) => (
                <tr key={p.id} className="border-t border-gray-200">
                  {/* 패키지명 고정 컬럼 */}
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {p.app_name ?? p.package}
                      </span>
                      {changedPackages.has(p.package) && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-900">
                          TEST
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{p.package}</div>
                  </td>
                  {/* 단말별 버전 셀 + 업데이트 시간 셀 */}
                  {deviceList.map((d) => {
                    const rec = latest.get(`${d.name}::${p.package}`);
                    const currentVer = rec
                      ? (rec.version_after ?? rec.version_before ?? null)
                      : null;
                    const updated = changedCells.has(`${d.name}::${p.package}`);
                    return (
                      <React.Fragment key={d.id}>
                        {/* 버전 셀 */}
                        <td
                          className={`border-l border-gray-200 px-3 py-2 align-top ${
                            updated ? "bg-red-50" : ""
                          }`}
                        >
                          {rec ? (
                            <div className="space-y-1">
                              <div
                                className={`font-mono text-xs ${
                                  updated
                                    ? "rounded bg-red-100 px-1 py-0.5 text-red-900"
                                    : "text-gray-900"
                                }`}
                              >
                                {currentVer ?? "—"}
                              </div>
                              {updated && rec.version_before && (
                                <div className="font-mono text-[11px] text-gray-400 line-through">
                                  {rec.version_before}
                                </div>
                              )}
                              {/* up_to_date 는 뱃지 표시 안 함 */}
                              {rec.status !== "up_to_date" && (
                                <Badge className={statusBadgeClass(rec.status)}>
                                  {rec.status}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        {/* 업데이트 시간 셀 */}
                        <td
                          className={`border-l border-gray-200 px-3 py-2 align-top ${
                            updated ? "bg-red-50" : ""
                          }`}
                        >
                          {rec ? (
                            <div className="text-[11px] text-gray-500 whitespace-nowrap">
                              {formatDateTime(rec.checked_at)}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              {packageList.length === 0 && (
                <tr>
                  <td
                    colSpan={deviceList.length * 2 + 1}
                    className="px-3 py-8 text-center text-sm text-gray-500"
                  >
                    등록된 패키지가 없습니다.
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
