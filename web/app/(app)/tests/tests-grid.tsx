// 테스트 트리거 그리드 + 펼침 패널 — 자동(scenario_runner) 결과 + 수동 체크박스 통합
"use client";

import React, { useMemo, useState, useTransition } from "react";
import { runScenario, recordManualCheck } from "@/app/actions/tests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { trackBadgeClass } from "@/lib/format";

interface Device {
  name: string;
  track: string;
  model: string | null;
}
interface Package {
  package: string;
  app_name: string | null;
  ref: string;
  test_supported: boolean;
}
interface SpecStep {
  id: string;
  desc: string;
  procedure?: string;
  expected?: string;
  note?: string;
  risky?: boolean;
}
interface Spec {
  package: string;
  ref: string;
  auto_steps: SpecStep[];
  manual_checks: SpecStep[];
}
interface TestRunLatest {
  id: number;
  device: string;
  package: string;
  scenario_id: string;
  result: string;
  reason: string | null;
  started_at: string;
  finished_at: string | null;
  log_excerpt: string | null;
  triggered_by: string;
  measurements: string | null;
  screenshot_path: string | null;
}
interface ManualCheckLatest {
  device: string;
  package: string;
  check_id: string;
  result: string;
  checker: string | null;
  checked_at: string;
  note: string | null;
}

interface TestsGridProps {
  devices: Device[];
  packages: Package[];
  specs: Spec[];
  testRuns: TestRunLatest[];
  manualChecks: ManualCheckLatest[];
  // `device::package` 형태. 보고 윈도우 안에 변경된 셀 키.
  changedKeys: string[];
  onlyToday: boolean;
}

type CellSummary = "pass" | "fail" | "pending" | "na" | "empty";

interface Selected {
  device: Device;
  pkg: Package;
}

function classify(
  spec: Spec | undefined,
  runs: TestRunLatest[],
  checks: ManualCheckLatest[],
  packageSupported: boolean
): CellSummary {
  if (!packageSupported || !spec) return "na";
  const runByScenario = new Map(runs.map((r) => [r.scenario_id, r.result]));
  const checkById = new Map(checks.map((c) => [c.check_id, c.result]));

  if (
    spec.auto_steps.some((s) => {
      const r = runByScenario.get(s.id);
      return r === "fail" || r === "error";
    })
  ) {
    return "fail";
  }
  if (spec.manual_checks.some((m) => checkById.get(m.id) === "fail")) {
    return "fail";
  }
  if (runs.length === 0 && checks.length === 0) return "empty";

  const autoAllDone =
    spec.auto_steps.length === 0 ||
    spec.auto_steps.every((s) => runByScenario.has(s.id));
  const manualAllDone =
    spec.manual_checks.length === 0 ||
    spec.manual_checks.every((m) => checkById.has(m.id));
  if (autoAllDone && manualAllDone) return "pass";
  return "pending";
}

function summaryStyle(s: CellSummary): { className: string; label: string } {
  switch (s) {
    case "pass":
      return { className: "bg-green-100 text-green-900", label: "PASS" };
    case "fail":
      return { className: "bg-red-100 text-red-900", label: "FAIL" };
    case "pending":
      return { className: "bg-yellow-100 text-yellow-900", label: "WAIT" };
    case "na":
      return { className: "bg-gray-200 text-gray-600", label: "N/A" };
    case "empty":
      return { className: "bg-gray-100 text-gray-500", label: "—" };
  }
}

function fmt(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("ko-KR", { hour12: false });
  } catch {
    return dt;
  }
}

function stepResultStyle(r: string | undefined): string {
  if (r === "pass") return "text-green-700";
  if (r === "fail" || r === "error") return "text-red-700 font-semibold";
  if (r === "skipped") return "text-gray-400";
  return "text-gray-400";
}

function parseMeasurements(json: string | null): Array<[string, string]> {
  if (!json) return [];
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(obj).map(([k, v]) => [k, String(v)]);
  } catch {
    return [];
  }
}

export function TestsGrid({
  devices,
  packages,
  specs,
  testRuns,
  manualChecks,
  changedKeys,
  onlyToday,
}: TestsGridProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [pendingRun, startRun] = useTransition();
  const [pendingCheck, startCheck] = useTransition();

  const changed = useMemo(() => new Set(changedKeys), [changedKeys]);
  const specByPackage = useMemo(
    () => new Map(specs.map((s) => [s.package, s])),
    [specs]
  );
  const runsByCell = useMemo(() => {
    const m = new Map<string, TestRunLatest[]>();
    for (const r of testRuns) {
      const k = `${r.device}::${r.package}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [testRuns]);
  const checksByCell = useMemo(() => {
    const m = new Map<string, ManualCheckLatest[]>();
    for (const c of manualChecks) {
      const k = `${c.device}::${c.package}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [manualChecks]);

  function onRunTest(d: Device, p: Package, includeRisky = false) {
    startRun(async () => {
      toast(`${d.name} / ${p.app_name ?? p.package} — 실행 중…`);
      const res = await runScenario(d.name, p.ref, includeRisky);
      if (!res.ok) {
        toast(`실행 실패 — ${res.error ?? `exit ${res.exit}`}`);
        return;
      }
      const items = res.output?.items ?? [];
      const fail = items.filter((i) => i.result === "fail" || i.result === "error").length;
      const pass = items.filter((i) => i.result === "pass").length;
      toast(`완료 — pass ${pass}, fail ${fail} (총 ${items.length})`);
    });
  }

  function onManualCheck(
    d: Device,
    p: Package,
    checkId: string,
    result: "pass" | "fail" | "skip"
  ) {
    startCheck(async () => {
      const res = await recordManualCheck(d.name, p.package, checkId, result);
      if (!res.ok) {
        toast(`수동 기록 실패 — ${res.error}`);
      } else {
        toast(`수동 기록됨 (${result})`);
      }
    });
  }

  const sel = selected
    ? {
        device: selected.device,
        pkg: selected.pkg,
        spec: specByPackage.get(selected.pkg.package),
        runs: runsByCell.get(`${selected.device.name}::${selected.pkg.package}`) ?? [],
        checks:
          checksByCell.get(`${selected.device.name}::${selected.pkg.package}`) ?? [],
      }
    : null;

  return (
    <div className="space-y-4">
      <div className="overflow-auto rounded-md border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
                단말 / 패키지
              </th>
              {packages.map((p) => (
                <th
                  key={p.package}
                  className="border-l border-gray-200 px-3 py-2 text-left font-medium text-gray-600"
                >
                  <div className="font-semibold text-gray-900">
                    {p.app_name ?? p.package}
                  </div>
                  <div className="text-xs font-normal text-gray-500">{p.package}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.name} className="border-t border-gray-200">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-3 py-2 align-top">
                  <div className="font-medium text-gray-900">
                    {d.model && d.model.trim() !== "" ? d.model : d.name}
                  </div>
                  <Badge className={trackBadgeClass(d.track)}>{d.track}</Badge>
                </td>
                {packages.map((p) => {
                  const cellKey = `${d.name}::${p.package}`;
                  const isTarget = changed.has(cellKey);
                  const dimmed = onlyToday && !isTarget;
                  const spec = specByPackage.get(p.package);
                  const runs = runsByCell.get(cellKey) ?? [];
                  const checks = checksByCell.get(cellKey) ?? [];
                  const cls = classify(spec, runs, checks, p.test_supported);
                  const style = summaryStyle(cls);
                  const isSelected =
                    selected?.device.name === d.name &&
                    selected?.pkg.package === p.package;
                  return (
                    <td
                      key={p.package}
                      className={`border-l border-gray-200 px-3 py-2 align-middle ${
                        isTarget ? "bg-red-50" : ""
                      } ${dimmed ? "opacity-30 pointer-events-none" : ""} ${
                        isSelected ? "ring-2 ring-blue-400" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`w-full rounded px-2 py-1 text-xs font-semibold ${style.className} ${
                          cls === "na" ? "cursor-default" : "hover:opacity-80"
                        }`}
                        onClick={() => {
                          if (cls === "na") return;
                          setSelected(isSelected ? null : { device: d, pkg: p });
                        }}
                        title={cls === "na" ? "테스트 미지원" : "클릭하여 상세 보기"}
                      >
                        {style.label}
                      </button>
                    </td>
                  );
                })}
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

      {sel && sel.spec && (
        <div className="rounded-md border border-gray-200 bg-white p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {sel.device.name} ({sel.device.track}) — {sel.pkg.app_name ?? sel.pkg.package}
              </h2>
              <div className="text-xs text-gray-500 font-mono">{sel.pkg.package}</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onRunTest(sel.device, sel.pkg)}
                disabled={pendingRun}
              >
                {pendingRun ? "실행 중…" : "Run Test"}
              </Button>
              {sel.spec.auto_steps.some((s) => s.risky) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRunTest(sel.device, sel.pkg, true)}
                  disabled={pendingRun}
                >
                  Run + Risky
                </Button>
              )}
            </div>
          </div>

          {/* 자동 결과 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">
              자동 시나리오 ({sel.spec.auto_steps.length})
            </h3>
            {sel.spec.auto_steps.length === 0 ? (
              <div className="text-xs text-gray-500">자동 시나리오 없음 (수동 점검만)</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-2 py-1">ID</th>
                    <th className="px-2 py-1">설명</th>
                    <th className="px-2 py-1">결과</th>
                    <th className="px-2 py-1">사유 / 측정값</th>
                    <th className="px-2 py-1">화면</th>
                    <th className="px-2 py-1">시작</th>
                    <th className="px-2 py-1">트리거</th>
                    <th className="px-2 py-1">로그</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.spec.auto_steps.map((step) => {
                    const r = sel.runs.find((x) => x.scenario_id === step.id);
                    const logKey = `${sel.device.name}::${sel.pkg.package}::${step.id}`;
                    const logOpen = expandedLogs.has(logKey);
                    return (
                      <React.Fragment key={step.id}>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="px-2 py-1 font-mono text-[11px]">
                          {step.id}
                          {step.risky && (
                            <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] text-orange-800">
                              risky
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-gray-700 max-w-md">
                          <div className="font-medium">{step.desc}</div>
                          {step.procedure && (
                            <div className="mt-1 whitespace-pre-line text-[11px] text-gray-600">
                              <span className="text-gray-400">시나리오 </span>
                              {step.procedure}
                            </div>
                          )}
                          {step.expected && (
                            <div className="mt-1 whitespace-pre-line text-[11px] text-emerald-700">
                              <span className="text-emerald-500">기대결과 </span>
                              {step.expected}
                            </div>
                          )}
                          {step.note && (
                            <div className="mt-1 text-[11px] text-amber-700">
                              <span className="text-amber-500">비고 </span>
                              {step.note}
                            </div>
                          )}
                        </td>
                        <td className={`px-2 py-1 ${stepResultStyle(r?.result)}`}>
                          {r?.result ?? "—"}
                        </td>
                        <td className="px-2 py-1 text-gray-600">
                          {r?.reason && (
                            <div className="text-red-700">{r.reason}</div>
                          )}
                          {r?.measurements && (
                            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-gray-700">
                              {parseMeasurements(r.measurements).map(([k, v]) => (
                                <span key={k}>
                                  <span className="text-gray-400">{k}=</span>
                                  {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {r?.screenshot_path ? (
                            <a
                              href={`/api/screenshot?id=${r.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-16"
                              title="클릭하여 확대"
                            >
                              <img
                                src={`/api/screenshot?id=${r.id}`}
                                alt="screenshot"
                                className="h-9 w-16 rounded border border-gray-200 object-cover hover:opacity-80"
                              />
                            </a>
                          ) : (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1 font-mono text-[11px] text-gray-500">
                          {fmt(r?.started_at)}
                        </td>
                        <td className="px-2 py-1 text-gray-500">{r?.triggered_by ?? "—"}</td>
                        <td className="px-2 py-1">
                          {r?.log_excerpt ? (
                            <button
                              type="button"
                              className="text-[11px] text-blue-600 underline hover:text-blue-900"
                              onClick={() => {
                                setExpandedLogs((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(logKey)) next.delete(logKey);
                                  else next.add(logKey);
                                  return next;
                                });
                              }}
                            >
                              {logOpen ? "닫기" : "로그"}
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                      {logOpen && r?.log_excerpt && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="border-t border-gray-200 px-3 py-2">
                            <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-gray-700">
{r.log_excerpt}
                            </pre>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {/* 수동 점검 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">
              수동 점검 ({sel.spec.manual_checks.length})
            </h3>
            {sel.spec.manual_checks.length === 0 ? (
              <div className="text-xs text-gray-500">수동 점검 없음</div>
            ) : (
              <ul className="space-y-2">
                {sel.spec.manual_checks.map((m) => {
                  const c = sel.checks.find((x) => x.check_id === m.id);
                  return (
                    <li
                      key={m.id}
                      className="flex items-start gap-3 rounded border border-gray-100 px-3 py-2"
                    >
                      <div className="flex-1">
                        <div className="font-mono text-[11px] text-gray-500">
                          {m.id}
                        </div>
                        <div className="text-xs font-medium text-gray-800">{m.desc}</div>
                        {m.procedure && (
                          <div className="mt-1 whitespace-pre-line text-[11px] text-gray-600">
                            <span className="text-gray-400">시나리오 </span>
                            {m.procedure}
                          </div>
                        )}
                        {m.expected && (
                          <div className="mt-1 whitespace-pre-line text-[11px] text-emerald-700">
                            <span className="text-emerald-500">기대결과 </span>
                            {m.expected}
                          </div>
                        )}
                        {m.note && (
                          <div className="mt-1 text-[11px] text-amber-700">
                            <span className="text-amber-500">비고 </span>
                            {m.note}
                          </div>
                        )}
                        {c && (
                          <div className="mt-2 text-[11px] text-gray-500">
                            최근 — <span className={stepResultStyle(c.result)}>{c.result}</span>{" "}
                            · {c.checker ?? "?"} · {fmt(c.checked_at)}
                            {c.note && <span> · {c.note}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingCheck}
                          onClick={() => onManualCheck(sel.device, sel.pkg, m.id, "pass")}
                        >
                          PASS
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingCheck}
                          onClick={() => onManualCheck(sel.device, sel.pkg, m.id, "fail")}
                        >
                          FAIL
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingCheck}
                          onClick={() => onManualCheck(sel.device, sel.pkg, m.id, "skip")}
                        >
                          SKIP
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
