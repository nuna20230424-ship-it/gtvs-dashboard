// active 컬럼 토글 스위치: Supabase 직접 update + router.refresh
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

interface ActiveToggleProps {
  table: "devices" | "packages";
  id: number;
  active: boolean;
}

export function ActiveToggle({ table, id, active }: ActiveToggleProps) {
  const [value, setValue] = useState(active);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function onToggle() {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from(table)
        .update({ active: next })
        .eq("id", id);
      if (error) {
        setValue(!next);
        toast(`업데이트 실패: ${error.message}`, "error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPending}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        value ? "bg-green-600" : "bg-gray-300"
      }`}
      aria-pressed={value}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
