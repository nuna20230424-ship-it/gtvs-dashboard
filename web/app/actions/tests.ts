// Tests 페이지 Server Actions — Python scenario_runner 트리거 + 수동 점검 응답 기록
"use server";

import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const PY_TIMEOUT_MS = 10 * 60 * 1000; // 10분 — 시나리오 1패키지 최대 시간 한도

export type RunScenarioResult = {
  ok: boolean;
  exit: number;
  output?: {
    package: string;
    device: string;
    items: Array<{ id: string; result: string; reason?: string }>;
  };
  error?: string;
};

// device 는 devices.name (예: STB-01). 내부에서 ip:port 로 변환.
export async function runScenario(
  device: string,
  ref: string,
  includeRisky = false
): Promise<RunScenarioResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, exit: -1, error: "unauthorized" };

  const updaterDir = process.env.GTVS_UPDATER_BAT_DIR;
  if (!updaterDir) {
    return { ok: false, exit: -1, error: "GTVS_UPDATER_BAT_DIR 미설정" };
  }

  const row = db
    .prepare("select ip, port, active from devices where name = ?")
    .get(device) as { ip: string; port: number; active: number } | undefined;
  if (!row) return { ok: false, exit: -1, error: `device '${device}' 없음` };
  if (!row.active) return { ok: false, exit: -1, error: `device '${device}' 비활성` };

  const adbTarget = `${row.ip}:${row.port}`;
  const runner = path.join(updaterDir, "gtvs_updater", "scenario_runner.py");

  const args = [
    runner,
    "--device", adbTarget,
    "--device-name", device,
    "--ref", ref,
    "--triggered-by", "manual",
    "--json",
  ];
  if (includeRisky) args.push("--include-risky");

  return new Promise<RunScenarioResult>((resolve) => {
    const child = spawn("python", args, {
      cwd: updaterDir,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });

    const tid = setTimeout(() => {
      child.kill("SIGTERM");
    }, PY_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(tid);
      let output: RunScenarioResult["output"];
      try {
        output = JSON.parse(stdout);
      } catch {
        // JSON 파싱 실패 — Python 측 비정상 종료. stderr/stdout 일부를 error 로 노출
      }
      revalidatePath("/tests");
      resolve({
        ok: code === 0,
        exit: code ?? -1,
        output,
        error:
          code !== 0
            ? (stderr.slice(0, 800) || stdout.slice(0, 800) || `exit ${code}`)
            : undefined,
      });
    });

    child.on("error", (e) => {
      clearTimeout(tid);
      resolve({
        ok: false,
        exit: -1,
        error: `spawn 실패 — ${e.message} (python 실행 가능 여부 확인)`,
      });
    });
  });
}

// 수동 점검 결과 기록 — tests 페이지 셀의 manual 체크박스에서 호출
export async function recordManualCheck(
  device: string,
  packageName: string,
  checkId: string,
  result: "pass" | "fail" | "skip",
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "unauthorized" };

  try {
    db.prepare(
      "insert into manual_checks (device, package, check_id, result, checker, note) values (?, ?, ?, ?, ?, ?)"
    ).run(device, packageName, checkId, result, session.user.email ?? null, note ?? null);
    revalidatePath("/tests");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
