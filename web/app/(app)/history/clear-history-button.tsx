// version_history 전체 삭제 client 버튼 — confirm 후 server action 호출
"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { clearVersionHistory } from "@/app/actions/history";

export function ClearHistoryButton({ totalCount }: { totalCount: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function handleClick() {
    if (busy) return;
    if (totalCount === 0) {
      toast("초기화할 이력이 없습니다.");
      return;
    }
    const ok = window.confirm(
      `version_history ${totalCount.toLocaleString()}건을 모두 삭제합니다. 계속하시겠습니까? (복구 불가)`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const result = await clearVersionHistory();
      if (result.ok) {
        toast(`이력 ${result.deleted.toLocaleString()}건 삭제 완료.`);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={busy || totalCount === 0}
    >
      {busy ? "초기화 중..." : `이력 초기화 (${totalCount.toLocaleString()}건)`}
    </Button>
  );
}
