// Records 테이블의 에러 셀: 클릭 시 풀텍스트 모달
"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

export function ErrorCell({ error }: { error: string | null }) {
  const [open, setOpen] = useState(false);
  if (!error) return <span className="text-gray-400">—</span>;

  const preview = error.length > 30 ? `${error.slice(0, 30)}…` : error;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-xs text-red-700 underline-offset-2 hover:underline"
        title="클릭하여 전체 보기"
      >
        {preview}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="에러 상세">
        <pre className="whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 text-xs text-gray-900">
          {error}
        </pre>
      </Dialog>
    </>
  );
}
