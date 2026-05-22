// GTVS Updater 수동 실행 페이지 — bat 트리거 버튼 + 최근 실행 로그 목록
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { listRecentRuns, countRunLogs } from "@/lib/runlogs";
import { formatDateTime } from "@/lib/format";
import { UpdaterControls } from "./updater-controls";

export const dynamic = "force-dynamic"; // 매 요청마다 최신 로그 반영

export default async function UpdaterPage() {
  const session = await auth();
  const recent = listRecentRuns(20);
  const totalLogs = countRunLogs();
  const batDir = process.env.GTVS_UPDATER_BAT_DIR ?? "(미설정)";

  return (
    <>
      <Header title="Updater" email={session?.user?.email ?? undefined} />
      <main className="flex-1 space-y-6 overflow-auto p-6">
        <section className="space-y-3 rounded-md border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">수동 실행</h2>
          <div className="text-xs text-gray-500">
            bat 디렉토리:{" "}
            <code className="font-mono text-gray-700">{batDir}</code>
          </div>
          <UpdaterControls totalLogs={totalLogs} />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">최근 실행 로그</h2>
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    시작
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    종료
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    모드
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    exit
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    PID
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    실행자
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    출력 (앞 200자)
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.file} className="border-t border-gray-200 align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {formatDateTime(r.startedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-600">
                      {r.finishedAt ? formatDateTime(r.finishedAt) : "—"}
                    </td>
                    <td className="px-3 py-2">{r.mode}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.exitCode === null ? "—" : r.exitCode}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.pid ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {r.triggeredBy ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-gray-700">
                      <div className="max-w-xl truncate" title={r.output ?? ""}>
                        {r.error
                          ? `ERROR: ${r.error}`
                          : (r.output ?? "").slice(0, 200)}
                      </div>
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm text-gray-500"
                    >
                      실행 로그가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
