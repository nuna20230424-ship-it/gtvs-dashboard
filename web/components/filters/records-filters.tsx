// Records 페이지 필터 폼: URL search params로 상태 유지
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface RecordsFiltersProps {
  devices: string[];
  packages: string[];
}

export function RecordsFilters({ devices, packages }: RecordsFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    for (const key of ["track", "device", "package", "status", "from", "to"]) {
      const v = String(form.get(key) ?? "").trim();
      if (v) next.set(key, v);
    }
    router.push(`/records?${next.toString()}`);
  }

  function onReset() {
    router.push("/records");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-7"
    >
      <Select name="track" defaultValue={params.get("track") ?? ""}>
        <option value="">track (전체)</option>
        <option value="beta">beta</option>
        <option value="production">production</option>
      </Select>
      <Select name="device" defaultValue={params.get("device") ?? ""}>
        <option value="">단말 (전체)</option>
        {devices.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select name="package" defaultValue={params.get("package") ?? ""}>
        <option value="">패키지 (전체)</option>
        {packages.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Select name="status" defaultValue={params.get("status") ?? ""}>
        <option value="">상태 (전체)</option>
        <option value="updated">updated</option>
        <option value="up_to_date">up_to_date</option>
        <option value="error">error</option>
      </Select>
      <Input
        type="date"
        name="from"
        defaultValue={params.get("from") ?? ""}
        placeholder="from"
      />
      <Input
        type="date"
        name="to"
        defaultValue={params.get("to") ?? ""}
        placeholder="to"
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
