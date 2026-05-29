// 자동화 테스트 트리거 페이지 — 단말×패키지 그리드. 셀 클릭 시 자동 결과 + 수동 체크박스 펼침
import Link from "next/link";
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { TestsGrid } from "./tests-grid";
import {
  listActiveDevices,
  listActivePackages,
  listChangedCellsSinceReport,
  listLatestTestRuns,
  listLatestManualChecks,
} from "@/lib/queries";
import { loadAllSpecs } from "@/lib/scenarios";
import { reportingWindowStartIso } from "@/lib/time";
import { formatDateTime } from "@/lib/format";

interface SearchParams {
  only?: string;
}

export const dynamic = "force-dynamic";

export default async function TestsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const devices = listActiveDevices();
  const packages = listActivePackages();
  const changedCells = listChangedCellsSinceReport();
  const windowStart = reportingWindowStartIso();
  const onlyToday = searchParams.only === "today";

  // 시나리오 spec (yaml) — 자동/수동 step id 목록
  const specMap = loadAllSpecs();
  const specs = packages.map((p) => {
    const s = specMap.get(p.package);
    return {
      package: p.package,
      ref: s?.ref ?? p.ref,
      auto_steps: s?.auto_steps ?? [],
      manual_checks: s?.manual_checks ?? [],
    };
  });

  // 최근 결과 — 셀별 매핑은 client 측에서 처리
  const testRuns = listLatestTestRuns();
  const manualChecks = listLatestManualChecks();

  return (
    <>
      <Header title="Tests" email={session?.user?.email ?? undefined} />
      <main className="flex-1 space-y-4 overflow-auto p-6">
        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
            <span>
              TEST 보고 윈도우
              <span className="ml-2 font-mono text-gray-900">
                {formatDateTime(windowStart)} ~
              </span>
            </span>
            <span className="text-gray-300">·</span>
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-900">
              {changedCells.size}개 대상
            </span>
          </div>
          <Link
            href={onlyToday ? "/tests" : "/tests?only=today"}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              onlyToday
                ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {onlyToday ? "전체 보기" : "TEST 대상만 보기"}
          </Link>
        </div>
        <TestsGrid
          devices={devices.map((d) => ({
            name: d.name,
            track: d.track,
            model: d.model,
          }))}
          packages={packages.map((p) => ({
            package: p.package,
            app_name: p.app_name,
            ref: p.ref,
            test_supported: p.test_supported,
          }))}
          specs={specs}
          testRuns={testRuns}
          manualChecks={manualChecks}
          changedKeys={[...changedCells]}
          onlyToday={onlyToday}
        />
      </main>
    </>
  );
}
