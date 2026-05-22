// GTVS Updater bat 수동 실행 API — POST { mode: 'once' | 'scheduler' }
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { auth } from "@/auth";
import { appendRunLog, type RunLog } from "@/lib/runlogs";
import { syncFromJsonl } from "@/lib/sync_jsonl";

// updater 실행 직후 Overview / Records 가 최신 데이터를 보이도록 캐시 무효화
function revalidateAfterRun() {
  revalidatePath("/");
  revalidatePath("/records");
  revalidatePath("/history");
  revalidatePath("/updater");
}

const ONCE_TIMEOUT_MS = 5 * 60 * 1000; // 5분
const OUTPUT_LIMIT = 64 * 1024; // 64KB

const BAT_BY_MODE = {
  once: "run_gtvs_updater_once.bat",
  scheduler: "run_gtvs_updater.bat",
} as const;

type Mode = keyof typeof BAT_BY_MODE;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode as Mode;
  if (mode !== "once" && mode !== "scheduler") {
    return NextResponse.json(
      { error: "Invalid mode (must be 'once' or 'scheduler')" },
      { status: 400 }
    );
  }

  const batDir = process.env.GTVS_UPDATER_BAT_DIR;
  if (!batDir) {
    return NextResponse.json(
      { error: "GTVS_UPDATER_BAT_DIR not configured in .env.local" },
      { status: 500 }
    );
  }

  const batName = BAT_BY_MODE[mode];
  const batPath = path.join(batDir, batName);
  if (!fs.existsSync(batPath)) {
    return NextResponse.json(
      { error: `bat file not found: ${batPath}` },
      { status: 500 }
    );
  }

  const startedAt = new Date().toISOString();
  const triggeredBy = session.user.email ?? null;

  // Python stdout/stderr 을 UTF-8 로 강제 — 한글 출력이 cp949 로 나와 깨지는 것 방지
  const spawnEnv = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  };

  // bat 파일은 첫 줄에서 자체적으로 `chcp 65001 > nul` 을 수행하므로 외부 chcp 호출 불필요.
  // 외부에서 `chcp 65001>nul & call "name.bat"` 형태로 args 를 넘기면 Node 의 Windows
  // args escape 가 따옴표를 \" 로 치환 → cmd 가 `\"name.bat\"` 를 파일명으로 해석해 실패함.
  // batName 은 공백 없는 ASCII 라 escape 영향 없이 바로 넘길 수 있음.

  if (mode === "scheduler") {
    // detached spawn — 부모(Next.js)와 분리. 종료/대기 하지 않음
    const child = spawn("cmd.exe", ["/c", batName], {
      cwd: batDir,
      env: spawnEnv,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();

    const log: RunLog = {
      startedAt,
      finishedAt: null,
      mode,
      exitCode: null,
      output: "(scheduler 모드: detached 실행 — 출력은 별도 콘솔로 흘러갑니다)",
      triggeredBy,
      pid: child.pid ?? null,
      bat: batName,
      error: null,
    };
    appendRunLog(log);
    revalidateAfterRun();

    return NextResponse.json({
      ok: true,
      mode,
      pid: child.pid ?? null,
      startedAt,
    });
  }

  // mode === 'once' — 동기 대기. stdout/stderr 캡처
  return new Promise<NextResponse>((resolve) => {
    const child = spawn("cmd.exe", ["/c", batName], {
      cwd: batDir,
      env: spawnEnv,
      windowsHide: true,
    });

    // Node 측에서도 일관된 UTF-8 디코드 — Buffer chunk 경계가 멀티바이트를 쪼개는 경우 방지
    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");

    let output = "";
    let truncated = false;
    const onData = (chunk: string) => {
      if (truncated) return;
      if (output.length + chunk.length > OUTPUT_LIMIT) {
        output += chunk.slice(0, OUTPUT_LIMIT - output.length);
        output += "\n... [truncated]";
        truncated = true;
      } else {
        output += chunk;
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    const timer = setTimeout(() => {
      child.kill();
    }, ONCE_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      const log: RunLog = {
        startedAt,
        finishedAt,
        mode: "once",
        exitCode: null,
        output,
        triggeredBy,
        pid: child.pid ?? null,
        bat: batName,
        error: err.message,
      };
      appendRunLog(log);
      resolve(
        NextResponse.json(
          { ok: false, error: err.message, output },
          { status: 500 }
        )
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();

      // bat 실행이 완료되었으므로 JSONL → SQLite 동기화 — Overview/Records에 즉시 반영
      let syncSummary: { updateRecords: number; versionHistory: number; skipped: number } | null = null;
      let syncError: string | null = null;
      try {
        const r = syncFromJsonl();
        syncSummary = {
          updateRecords: r.updateRecords,
          versionHistory: r.versionHistory,
          skipped: r.skipped,
        };
      } catch (err) {
        syncError = err instanceof Error ? err.message : String(err);
      }

      const log: RunLog = {
        startedAt,
        finishedAt,
        mode: "once",
        exitCode: code,
        output:
          output +
          (syncSummary
            ? `\n\n[SYNC] update_records +${syncSummary.updateRecords}, version_history +${syncSummary.versionHistory}, skipped ${syncSummary.skipped}`
            : syncError
              ? `\n\n[SYNC FAIL] ${syncError}`
              : ""),
        triggeredBy,
        pid: child.pid ?? null,
        bat: batName,
        error: null,
      };
      appendRunLog(log);
      revalidateAfterRun();
      resolve(
        NextResponse.json({
          ok: code === 0,
          mode: "once",
          exitCode: code,
          output,
          sync: syncSummary,
          syncError,
          startedAt,
          finishedAt,
        })
      );
    });
  });
}
