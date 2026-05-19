// 버전 변경 이력 페이지 — 필터/페이지네이션 지원 (SQLite 직접 조회)
import Link from "next/link";
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { HistoryFilters } from "@/components/filters/history-filters";
import {
  listHistory,
  listDeviceNames,
  listPackageNames,
} from "@/lib/queries";
import { parseHistoryFilters, parsePagination } from "@/lib/filters";
import {
  formatDateTime,
  sourceBadgeClass,
  trackBadgeClass,
} from "@/lib/format";

const PAGE_SIZE = 50;

interface SearchParams {
  track?: string;
  device?: string;
  package?: string;
  source?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  const filters = parseHistoryFilters(searchParams);
  const pagination = parsePagination(searchParams, PAGE_SIZE);
  const { rows, count } = listHistory(filters, pagination);
  const devices = listDeviceNames();
  const packages = listPackageNames();

  const page = Math.floor(pagination.offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v && k !== "page") baseQuery.set(k, String(v));
  }
  const linkFor = (p: number) => {
    const next = new URLSearchParams(baseQuery);
    next.set("page", String(p));
    return `/history?${next.toString()}`;
  };

  return (
    <>
      <Header title="Version History" email={session?.user?.email ?? undefined} />
      <main className="flex-1 space-y-4 overflow-auto p-6">
        <HistoryFilters devices={devices} packages={packages} />

        <Table>
          <THead>
            <TR>
              <TH>변경시각</TH>
              <TH>단말</TH>
              <TH>패키지</TH>
              <TH>앱이름</TH>
              <TH>이전 → 현재 버전</TH>
              <TH>source</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap">{formatDateTime(r.changed_at)}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span>{r.device}</span>
                    <Badge className={trackBadgeClass(r.track)}>{r.track}</Badge>
                  </div>
                </TD>
                <TD className="font-mono text-xs">{r.package}</TD>
                <TD>{r.app_name ?? "—"}</TD>
                <TD className="font-mono text-xs">
                  {r.version_before ?? "—"}{" "}
                  <span className="text-gray-400">→</span>{" "}
                  {r.version_after ?? "—"}
                </TD>
                <TD>
                  <Badge className={sourceBadgeClass(r.source)}>{r.source}</Badge>
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={6} className="text-center text-gray-500">
                  변경 이력이 없습니다.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            총 {count.toLocaleString()}건 · {page}/{totalPages} 페이지
          </div>
          <div className="flex gap-2">
            <Link
              href={linkFor(Math.max(1, page - 1))}
              className={`rounded-md border px-3 py-1 ${
                page <= 1
                  ? "pointer-events-none border-gray-200 text-gray-400"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              이전
            </Link>
            <Link
              href={linkFor(Math.min(totalPages, page + 1))}
              className={`rounded-md border px-3 py-1 ${
                page >= totalPages
                  ? "pointer-events-none border-gray-200 text-gray-400"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              다음
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
