// 스크린샷 PNG 응답 — test_runs.screenshot_path 가 가리키는 절대 경로 파일을 image/png 로 스트림
// 인증된 사용자만, path 는 DB 에서만 받아오므로 directory traversal 위험 없음
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) {
    return new NextResponse("missing id", { status: 400 });
  }
  const id = parseInt(idParam, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return new NextResponse("bad id", { status: 400 });
  }

  const row = db
    .prepare("select screenshot_path from test_runs where id = ?")
    .get(id) as { screenshot_path: string | null } | undefined;
  if (!row || !row.screenshot_path) {
    return new NextResponse("no screenshot", { status: 404 });
  }
  try {
    const buf = await fs.readFile(row.screenshot_path);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("file not found", { status: 404 });
  }
}
