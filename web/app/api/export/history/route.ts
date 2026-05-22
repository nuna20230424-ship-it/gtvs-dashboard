// Version History .xlsx 내보내기 — query: 기존 필터 + scope=page|all
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { listAllHistory, listHistory } from "@/lib/queries";
import { parseHistoryFilters, parsePagination } from "@/lib/filters";
import { buildExportFilename, historyToXlsx } from "@/lib/exporters";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const filters = parseHistoryFilters(sp);
  const scope = sp.get("scope") === "page" ? "page" : "all";

  const rows =
    scope === "page"
      ? listHistory(filters, parsePagination(sp, PAGE_SIZE)).rows
      : listAllHistory(filters);

  const buf = await historyToXlsx(rows);
  return new NextResponse(
    new Blob([buf as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${buildExportFilename("history")}"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
