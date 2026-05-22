// Updater 수동 실행 버튼 (client) — 'once' 동기 / 'scheduler' fire-and-forget
"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface RunResponse {
  ok: boolean;
  mode?: "once" | "scheduler";
  exitCode?: number | null;
  pid?: number | null;
  output?: string;
  error?: string;
  sync?: { updateRecords: number; versionHistory: number; skipped: number };
}

interface SyncResponse {
  ok: boolean;
  updateRecords?: number;
  versionHistory?: number;
  skipped?: number;
  error?: string;
}

interface ClearLogsResponse {
  ok: boolean;
  deleted?: number;
  error?: string;
}

type BusyState = null | "once" | "scheduler" | "sync" | "clear";

export function UpdaterControls({ totalLogs }: { totalLogs: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<BusyState>(null);
  const [lastOutput, setLastOutput] = React.useState<string>("");

  async function run(mode: "once" | "scheduler") {
    if (busy) return;
    setBusy(mode);
    setLastOutput("");
    try {
      const res = await fetch("/api/updater/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as RunResponse;
      if (!res.ok || !data.ok) {
        toast(data.error ?? `실행 실패 (HTTP ${res.status})`, "error");
        if (data.output) setLastOutput(data.output);
      } else if (mode === "scheduler") {
        toast(`스케줄러 시작 (PID ${data.pid ?? "?"}) — 별도 콘솔에서 실행 중`);
      } else {
        const syncMsg = data.sync
          ? ` · DB 반영 +${data.sync.updateRecords}/+${data.sync.versionHistory}`
          : "";
        toast(
          `1회 실행 완료 (exit ${data.exitCode ?? "?"})${syncMsg}`,
          data.exitCode === 0 ? "default" : "error"
        );
        if (data.output) setLastOutput(data.output);
      }
      router.refresh();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "네트워크 오류",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }

  async function clearLogs() {
    if (busy) return;
    if (totalLogs === 0) {
      toast("초기화할 실행 로그가 없습니다.");
      return;
    }
    const ok = window.confirm(
      `.runlogs 디렉토리의 실행 로그 ${totalLogs.toLocaleString()}건을 모두 삭제합니다. 계속하시겠습니까? (복구 불가)`
    );
    if (!ok) return;

    setBusy("clear");
    try {
      const res = await fetch("/api/updater/clear-logs", { method: "POST" });
      const data = (await res.json()) as ClearLogsResponse;
      if (!res.ok || !data.ok) {
        toast(data.error ?? `초기화 실패 (HTTP ${res.status})`, "error");
      } else {
        toast(`실행 로그 ${(data.deleted ?? 0).toLocaleString()}건 삭제 완료.`);
      }
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "네트워크 오류", "error");
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    if (busy) return;
    setBusy("sync");
    try {
      const res = await fetch("/api/updater/sync", { method: "POST" });
      const data = (await res.json()) as SyncResponse;
      if (!res.ok || !data.ok) {
        toast(data.error ?? `동기화 실패 (HTTP ${res.status})`, "error");
      } else {
        toast(
          `동기화 완료 — update_records +${data.updateRecords ?? 0}, version_history +${data.versionHistory ?? 0} (스킵 ${data.skipped ?? 0})`
        );
      }
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "네트워크 오류", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => run("once")}
          disabled={busy !== null}
          size="md"
        >
          {busy === "once" ? "실행 중..." : "지금 1회 실행 (once)"}
        </Button>
        <Button
          onClick={() => run("scheduler")}
          disabled={busy !== null}
          size="md"
          variant="outline"
        >
          {busy === "scheduler" ? "시작 중..." : "스케줄러 시작 (forever)"}
        </Button>
        <Button
          onClick={sync}
          disabled={busy !== null}
          size="md"
          variant="ghost"
        >
          {busy === "sync" ? "동기화 중..." : "JSONL → SQLite 수동 동기화"}
        </Button>
        <Button
          onClick={clearLogs}
          disabled={busy !== null || totalLogs === 0}
          size="md"
          variant="destructive"
        >
          {busy === "clear"
            ? "초기화 중..."
            : `실행 로그 초기화 (${totalLogs.toLocaleString()}건)`}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        once: 1회 실행 후 종료 + DB 자동 반영. scheduler: 백그라운드 detached 실행, 즉시 응답
        (종료는 작업 관리자 / PID kill). 수동 동기화: 스케줄러가 백그라운드로 쓴 JSONL 을 Overview 에 즉시 반영.
      </p>
      {lastOutput && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-800">
          {lastOutput}
        </pre>
      )}
    </div>
  );
}
