// JSONL → SQLite 수동 동기화 — 스케줄러로 쌓인 데이터 강제 반영용
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { syncFromJsonl } from "@/lib/sync_jsonl";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = syncFromJsonl();
    revalidatePath("/");
    revalidatePath("/records");
    revalidatePath("/history");
    return NextResponse.json({ ok: true, ...result });
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
