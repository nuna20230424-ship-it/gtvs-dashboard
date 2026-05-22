// History 페이지 필터 폼 — URL 변경 시 controlled state 를 useEffect 로 동기화
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface HistoryFiltersProps {
  // value=단말 name(stb-01), label=모델명 fallback
  devices: Array<{ name: string; label: string }>;
  packages: string[];
}

const FIELDS = ["track", "device", "package", "source", "from", "to"] as const;
type Field = (typeof FIELDS)[number];

function readFromParams(
  params: URLSearchParams | ReadonlyURLSearchParams
): Record<Field, string> {
  return {
    track: params.get("track") ?? "",
    device: params.get("device") ?? "",
    package: params.get("package") ?? "",
    source: params.get("source") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

type ReadonlyURLSearchParams = ReturnType<typeof useSearchParams>;

export function HistoryFilters({ devices, packages }: HistoryFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = React.useState<Record<Field, string>>(() =>
    readFromParams(params)
  );

  // URL params 가 변경될 때마다 폼 상태를 동기화 — defaultValue 가 재반영되지 않는 문제 회피
  React.useEffect(() => {
    setState(readFromParams(params));
  }, [params]);

  function onChange(field: Field, value: string) {
    setState((s) => ({ ...s, [field]: value }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams();
    for (const key of FIELDS) {
      const v = state[key].trim();
      if (v) next.set(key, v);
    }
    router.push(`/history?${next.toString()}`);
  }

  function onReset() {
    router.push("/history");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-7"
    >
      <Select
        name="track"
        value={state.track}
        onChange={(e) => onChange("track", e.target.value)}
      >
        <option value="">track (전체)</option>
        <option value="beta">beta</option>
        <option value="production">production</option>
      </Select>
      <Select
        name="device"
        value={state.device}
        onChange={(e) => onChange("device", e.target.value)}
      >
        <option value="">단말 (전체)</option>
        {devices.map((d) => (
          <option key={d.name} value={d.name}>
            {d.label}
          </option>
        ))}
      </Select>
      <Select
        name="package"
        value={state.package}
        onChange={(e) => onChange("package", e.target.value)}
      >
        <option value="">패키지 (전체)</option>
        {packages.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Select
        name="source"
        value={state.source}
        onChange={(e) => onChange("source", e.target.value)}
      >
        <option value="">source (전체)</option>
        <option value="auto">auto</option>
        <option value="manual">manual</option>
      </Select>
      <Input
        type="date"
        name="from"
        value={state.from}
        onChange={(e) => onChange("from", e.target.value)}
      />
      <Input
        type="date"
        name="to"
        value={state.to}
        onChange={(e) => onChange("to", e.target.value)}
      />
      <div className="flex gap-2">
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
