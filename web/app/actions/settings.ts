// Settings 페이지 mutation server actions — active 토글
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

type ToggleTarget = "devices" | "packages";

export async function toggleActive(
  table: ToggleTarget,
  id: number,
  next: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  // SQL injection 방지 — 화이트리스트 검증 후에만 테이블명을 SQL에 박는다
  if (table !== "devices" && table !== "packages") {
    return { ok: false, error: "Invalid table" };
  }

  try {
    db.prepare(`update ${table} set active = ? where id = ?`).run(
      next ? 1 : 0,
      id
    );
    revalidatePath("/settings");
    revalidatePath("/");
    revalidatePath("/tests");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
