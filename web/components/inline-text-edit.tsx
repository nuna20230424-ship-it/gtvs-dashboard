// 인라인 텍스트 편집 — blur 또는 Enter 로 저장. 빈 문자열은 NULL 로 처리.
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

interface InlineTextEditProps {
  initial: string | null;
  placeholder?: string;
  save: (next: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  className?: string;
}

export function InlineTextEdit({
  initial,
  placeholder,
  save,
  className = "",
}: InlineTextEditProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState(initial ?? "");
  const [saving, setSaving] = React.useState(false);
  const lastSavedRef = React.useRef(initial ?? "");

  async function commit() {
    if (value === lastSavedRef.current) return;
    setSaving(true);
    const res = await save(value);
    setSaving(false);
    if (!res.ok) {
      toast(`저장 실패: ${res.error}`, "error");
      setValue(lastSavedRef.current);
      return;
    }
    lastSavedRef.current = value;
    router.refresh();
  }

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setValue(lastSavedRef.current);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`h-7 w-full rounded border border-gray-200 bg-white px-2 text-xs text-gray-900 focus:border-gray-400 focus:outline-none disabled:opacity-50 ${className}`}
    />
  );
}
