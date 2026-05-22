// Overview 헤더의 STB 모델명 인라인 편집 (devices.model 업데이트)
"use client";

import { updateDeviceModel } from "@/app/actions/settings";
import { InlineTextEdit } from "@/components/inline-text-edit";

export function OverviewModelCell({
  id,
  initial,
}: {
  id: number;
  initial: string | null;
}) {
  return (
    <InlineTextEdit
      initial={initial}
      placeholder="모델명"
      save={(next) => updateDeviceModel(id, next)}
    />
  );
}
