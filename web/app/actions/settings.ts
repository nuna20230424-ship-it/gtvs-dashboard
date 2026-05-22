// Settings 페이지 mutation server actions — active 토글 + 메타 필드(model, opt_in, rollout_status) 수정
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

type ToggleTarget = "devices" | "packages";

type ActionResult = { ok: true } | { ok: false; error: string };

function unauthorized(): ActionResult {
  return { ok: false, error: "Unauthorized" };
}

function revalidateAll() {
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/records");
  revalidatePath("/tests");
}

export async function toggleActive(
  table: ToggleTarget,
  id: number,
  next: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (!session) return unauthorized();

  // SQL injection 방지 — 화이트리스트 검증 후에만 테이블명을 SQL에 박는다
  if (table !== "devices" && table !== "packages") {
    return { ok: false, error: "Invalid table" };
  }

  try {
    db.prepare(`update ${table} set active = ? where id = ?`).run(
      next ? 1 : 0,
      id
    );
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// devices.model 단일 텍스트 필드 수정 — Overview 헤더 입력칸 + Settings 양쪽에서 사용
export async function updateDeviceModel(
  id: number,
  value: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session) return unauthorized();

  const trimmed = value.trim();
  try {
    db.prepare("update devices set model = ? where id = ?").run(
      trimmed === "" ? null : trimmed,
      id
    );
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// packages.opt_in (beta 템플릿) / packages.rollout_status (production 템플릿)
const PACKAGE_TEXT_FIELDS = ["opt_in", "rollout_status"] as const;
type PackageTextField = (typeof PACKAGE_TEXT_FIELDS)[number];

export async function updatePackageField(
  id: number,
  field: PackageTextField,
  value: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session) return unauthorized();

  if (!PACKAGE_TEXT_FIELDS.includes(field)) {
    return { ok: false, error: "Invalid field" };
  }

  const trimmed = value.trim();
  try {
    db.prepare(`update packages set ${field} = ? where id = ?`).run(
      trimmed === "" ? null : trimmed,
      id
    );
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
