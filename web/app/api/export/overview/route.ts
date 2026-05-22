// Overview 매트릭스 .xlsx 내보내기 — 현재 active 단말×패키지의 최신 버전 매트릭스
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listActiveDevices,
  listActivePackages,
  listLatestRecordsForOverview,
} from "@/lib/queries";
import {
  buildExportFilename,
  overviewMatrixToXlsx,
} from "@/lib/exporters";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devices = listActiveDevices();
  const packages = listActivePackages();
  const records = listLatestRecordsForOverview(2000);

  const latestByKey = new Map<
    string,
    { version_after: string | null; status: string; checked_at: string }
  >();
  for (const r of records) {
    const key = `${r.device}::${r.package}`;
    if (!latestByKey.has(key)) {
      // up_to_date 일 때 version_after 가 null 이므로 version_before fallback
      latestByKey.set(key, {
        version_after: r.version_after ?? r.version_before ?? null,
        status: r.status,
        checked_at: r.checked_at,
      });
    }
  }

  const buf = await overviewMatrixToXlsx({
    devices: devices.map((d) => ({
      name: d.name,
      track: d.track,
      model: d.model,
    })),
    packages: packages.map((p) => ({
      package: p.package,
      app_name: p.app_name,
    })),
    latestByKey,
  });

  return new NextResponse(
    new Blob([buf as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${buildExportFilename("overview")}"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
