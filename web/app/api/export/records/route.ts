// Records .xlsx 내보내기 — track 별 템플릿(beta/production)으로 출력
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { buildTemplate, type TemplateTrack } from "@/lib/template";
import { buildExportFilename, templateToXlsx } from "@/lib/exporters";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const trackParam = sp.get("track");
  const track: TemplateTrack = trackParam === "production" ? "production" : "beta";
  const packageFilter = sp.get("package") ?? undefined;

  const result = buildTemplate(track, { package: packageFilter });
  const buf = await templateToXlsx(result);

  return new NextResponse(
    new Blob([buf as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${buildExportFilename(`records_${track}`)}"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
