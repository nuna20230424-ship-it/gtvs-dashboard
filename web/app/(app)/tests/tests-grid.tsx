// 테스트 트리거 그리드 (클라이언트): Run Test 버튼은 placeholder
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { trackBadgeClass } from "@/lib/format";

interface Device {
  name: string;
  track: string;
}
interface Package {
  package: string;
  app_name: string | null;
}

interface TestsGridProps {
  devices: Device[];
  packages: Package[];
}

export function TestsGrid({ devices, packages }: TestsGridProps) {
  const { toast } = useToast();

  function runTest(_device: string, _pkg: string) {
    // TODO: 자동화 스크립트 연결
    toast("준비 중 — 자동화 스크립트 연결 예정");
  }

  return (
    <div className="overflow-auto rounded-md border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
              단말 \ 패키지
            </th>
            {packages.map((p) => (
              <th
                key={p.package}
                className="border-l border-gray-200 px-3 py-2 text-left font-medium text-gray-600"
              >
                <div className="font-semibold text-gray-900">
                  {p.app_name ?? p.package}
                </div>
                <div className="text-xs font-normal text-gray-500">
                  {p.package}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.name} className="border-t border-gray-200">
              <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 align-top">
                <div className="font-medium text-gray-900">{d.name}</div>
                <Badge className={trackBadgeClass(d.track)}>{d.track}</Badge>
              </td>
              {packages.map((p) => (
                <td
                  key={p.package}
                  className="border-l border-gray-200 px-3 py-2 align-middle"
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runTest(d.name, p.package)}
                  >
                    Run Test
                  </Button>
                </td>
              ))}
            </tr>
          ))}
          {devices.length === 0 && (
            <tr>
              <td
                colSpan={packages.length + 1}
                className="px-3 py-8 text-center text-sm text-gray-500"
              >
                등록된 단말이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
