// .runlogs 디렉토리의 모든 실행 로그 JSON 삭제 — POST 호출 시 1회 수행
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { clearRunLogs } from "@/lib/runlogs";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = clearRunLogs();
    revalidatePath("/updater");
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
