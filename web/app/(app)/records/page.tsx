// 업데이트 조회 기록 페이지: 필터링/페이지네이션 지원 테이블
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { RecordsFilters } from "@/components/filters/records-filters";
import { ErrorCell } from "./error-cell";
import {
  formatDateTime,
  statusBadgeClass,
  trackBadgeClass,
} from "@/lib/format";

const PAGE_SIZE = 50;

interface SearchParams {
  track?: string;
  device?: string;
  package?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const fromIdx = (page - 1) * PAGE_SIZE;
  const toIdx = fromIdx + PAGE_SIZE - 1;

  let q = supabase
    .from("update_records")
    .select(
      "id,device,track,package,ref,app_name,status,version_before,version_after,error,checked_at",
      { count: "exact" }
    )
    .order("checked_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (searchParams.track) q = q.eq("track", searchParams.track);
  if (searchParams.device) q = q.eq("device", searchParams.device);
  if (searchParams.package) q = q.eq("package", searchParams.package);
  if (searchParams.status) q = q.eq("status", searchParams.status);
  if (searchParams.from) q = q.gte("checked_at", searchParams.from);
  if (searchParams.to) q = q.lte("checked_at", `${searchParams.to}T23:59:59`);

  const [{ data: rows, count }, { data: devices }, { data: packages }] =
    await Promise.all([
      q,
      supabase.from("devices").select("name").order("name"),
      supabase.from("packages").select("package").order("package"),
    ]);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v && k !== "page") baseQuery.set(k, String(v));
  }
  const linkFor = (p: number) => {
    const next = new URLSearchParams(baseQuery);
    next.set("page", String(p));
    return `/records?${next.toString()}`;
  };

  return (
    <>
      <Header title="Update Records" email={user?.email} />
      <main className="flex-1 space-y-4 overflow-auto p-6">
        <RecordsFilters
          devices={(devices ?? []).map((d) => d.name)}
          packages={(packages ?? []).map((p) => p.package)}
        />

        <Table>
          <THead>
            <TR>
              <TH>조회시간</TH>
              <TH>단말</TH>
              <TH>패키지</TH>
              <TH>앱이름</TH>
              <TH>ref</TH>
              <TH>이전버전</TH>
              <TH>현재버전</TH>
              <TH>상태</TH>
              <TH>에러</TH>
            </TR>
          </THead>
          <TBody>
            {(rows ?? []).map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap">{formatDateTime(r.checked_at)}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span>{r.device}</span>
                    <Badge className={trackBadgeClass(r.track)}>{r.track}</Badge>
                  </div>
                </TD>
                <TD className="font-mono text-xs">{r.package}</TD>
                <TD>{r.app_name ?? "—"}</TD>
                <TD className="font-mono text-xs">{r.ref ?? "—"}</TD>
                <TD className="font-mono text-xs">{r.version_before ?? "—"}</TD>
                <TD className="font-mono text-xs">{r.version_after ?? "—"}</TD>
                <TD>
                  <Badge className={statusBadgeClass(r.status)}>{r.status}</Badge>
                </TD>
                <TD>
                  <ErrorCell error={r.error} />
                </TD>
              </TR>
            ))}
            {(!rows || rows.length === 0) && (
              <TR>
                <TD colSpan={9} className="text-center text-gray-500">
                  조회 결과가 없습니다.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            총 {total.toLocaleString()}건 · {page}/{totalPages} 페이지
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
