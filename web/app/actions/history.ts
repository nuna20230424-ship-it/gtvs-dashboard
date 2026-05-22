// version_history 이력 초기화 server action — auth 체크 후 전체 삭제, 삭제 건수 반환
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

type ActionResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

export async function clearVersionHistory(): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "Unauthorized" };

  try {
    const info = db.prepare("delete from version_history").run();
    revalidatePath("/history");
    return { ok: true, deleted: info.changes };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
