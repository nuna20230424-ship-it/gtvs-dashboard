// Settings 페이지의 인라인 편집 셀들 — 서버 액션을 client 측에서 호출 가능하도록 wrapper
"use client";

import * as React from "react";
import {
  updateDeviceModel,
  updatePackageField,
} from "@/app/actions/settings";
import { InlineTextEdit } from "@/components/inline-text-edit";

export function DeviceModelCell({
  id,
  initial,
}: {
  id: number;
  initial: string | null;
}) {
  return (
    <InlineTextEdit
      initial={initial}
      placeholder="예: Chromecast 4K"
      save={(next) => updateDeviceModel(id, next)}
    />
  );
}

export function PackageOptInCell({
  id,
  initial,
}: {
  id: number;
  initial: string | null;
}) {
  return (
    <InlineTextEdit
      initial={initial}
      placeholder="예: talkback"
      save={(next) => updatePackageField(id, "opt_in", next)}
    />
  );
}

export function PackageRolloutCell({
  id,
  initial,
}: {
  id: number;
  initial: string | null;
}) {
  return (
    <InlineTextEdit
      initial={initial}
      placeholder="예: COMPLETED"
      save={(next) => updatePackageField(id, "rollout_status", next)}
    />
  );
}
