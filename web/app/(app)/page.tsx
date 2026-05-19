// Overview 페이지 — 단말 × 패키지 최신 버전 매트릭스
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import {
  listActiveDevices,
  listActivePackages,
  listLatestRecordsForOverview,
  type OverviewRow,
} from "@/lib/queries";
import {
  formatDateTime,
  statusBadgeClass,
  trackBadgeClass,
} from "@/lib/format";

export default async function OverviewPage() {
  const session = await auth();
  const deviceList = listActiveDevices();
  const packageList = listActivePackages();
  const recordList = listLatestRecordsForOverview(2000);

  // 단말×패키지별 최신 1건만 유지
  const latest = new Map<string, OverviewRow>();
  for (const r of recordList) {
    const key = `${r.device}::${r.package}`;
    if (!latest.has(key)) latest.set(key, r);
  }

  return (
    <>
      <Header title="Overview" email={session?.user?.email ?? undefined} />
      <main className="flex-1 overflow-auto p-6">
        <div className="overflow-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
                  단말 \ 패키지
                </th>
                {packageList.map((p) => (
                  <th
                    key={p.package}
                    className="border-l border-gray-200 px-3 py-2 text-left font-medium text-gray-600"
                  >
                    <div className="font-semibold text-gray-900">
                      {p.app_name ?? p.package}
                    </div>
                    <div className="text-xs font-normal text-gray-500">
                      {p.package}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deviceList.map((d) => (
                <tr key={d.id} className="border-t border-gray-200">
                  <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 align-top">
                    <div className="font-medium text-gray-900">{d.name}</div>
                    <Badge className={trackBadgeClass(d.track)}>{d.track}</Badge>
                  </td>
                  {packageList.map((p) => {
                    const rec = latest.get(`${d.name}::${p.package}`);
                    return (
                      <td
                        key={p.package}
                        className="border-l border-gray-200 px-3 py-2 align-top"
                      >
                        {rec ? (
                          <div className="space-y-1">
                            <div className="font-mono text-xs text-gray-900">
                              {rec.version_after ?? "—"}
                            </div>
                            <Badge className={statusBadgeClass(rec.status)}>
                              {rec.status}
                            </Badge>
                            <div className="text-[11px] text-gray-500">
                              {formatDateTime(rec.checked_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {deviceList.length === 0 && (
                <tr>
                  <td
                    colSpan={packageList.length + 1}
                    className="px-3 py-8 text-center text-sm text-gray-500"
                  >
                    등록된 단말이 없습니다.
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
