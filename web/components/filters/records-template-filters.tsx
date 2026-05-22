// Records 템플릿 페이지의 간소 필터 — track 전환 + 패키지 단일 선택 (controlled state)
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  packages: string[];
}

export function RecordsTemplateFilters({ packages }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const [track, setTrack] = React.useState<string>(params.get("track") ?? "beta");
  const [pkg, setPkg] = React.useState<string>(params.get("package") ?? "");

  React.useEffect(() => {
    setTrack(params.get("track") ?? "beta");
    setPkg(params.get("package") ?? "");
  }, [params]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (track) next.set("track", track);
    if (pkg) next.set("package", pkg);
    router.push(`/records?${next.toString()}`);
  }

  function onReset() {
    router.push("/records");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-5"
    >
      <Select
        name="track"
        value={track}
        onChange={(e) => setTrack(e.target.value)}
      >
        <option value="beta">beta</option>
        <option value="production">production</option>
      </Select>
      <Select
        name="package"
        value={pkg}
        onChange={(e) => setPkg(e.target.value)}
      >
        <option value="">패키지 (전체)</option>
        {packages.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <div className="flex gap-2 md:col-span-3">
        <Button type="submit" size="md">
          적용
        </Button>
        <Button type="button" size="md" variant="outline" onClick={onReset}>
          초기화
        </Button>
      </div>
    </form>
  );
}
