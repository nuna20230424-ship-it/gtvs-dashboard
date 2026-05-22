// 설정 페이지 — 단말(active, model) / 패키지(active, opt_in, rollout_status) 편집
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ActiveToggle } from "./active-toggle";
import {
  DeviceModelCell,
  PackageOptInCell,
  PackageRolloutCell,
} from "./edit-cells";
import { listAllDevices, listAllPackages } from "@/lib/queries";
import { trackBadgeClass } from "@/lib/format";

export default async function SettingsPage() {
  const session = await auth();
  const devices = listAllDevices();
  const packages = listAllPackages();

  return (
    <>
      <Header title="Settings" email={session?.user?.email ?? undefined} />
      <main className="flex-1 space-y-8 overflow-auto p-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">단말 (devices)</h3>
          <p className="text-xs text-gray-500">
            모델명은 Overview 헤더에서도 인라인 편집 가능
          </p>
          <Table>
            <THead>
              <TR>
                <TH>이름</TH>
                <TH>track</TH>
                <TH>IP</TH>
                <TH>port</TH>
                <TH className="w-56">모델명</TH>
                <TH className="w-24 text-right">active</TH>
              </TR>
            </THead>
            <TBody>
              {devices.map((d) => (
                <TR key={d.id}>
                  <TD>{d.name}</TD>
                  <TD>
                    <Badge className={trackBadgeClass(d.track)}>{d.track}</Badge>
                  </TD>
                  <TD className="font-mono text-xs">{d.ip ?? "—"}</TD>
                  <TD className="font-mono text-xs">{d.port ?? "—"}</TD>
                  <TD>
                    <DeviceModelCell id={d.id} initial={d.model} />
                  </TD>
                  <TD className="text-right">
                    <ActiveToggle table="devices" id={d.id} active={d.active} />
                  </TD>
                </TR>
              ))}
              {devices.length === 0 && (
                <TR>
                  <TD colSpan={6} className="text-center text-gray-500">
                    등록된 단말이 없습니다.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">패키지 (packages)</h3>
          <p className="text-xs text-gray-500">
            Opt-In은 beta 템플릿, Rollout Status는 production 템플릿에서 노출됨
          </p>
          <Table>
            <THead>
              <TR>
                <TH>패키지</TH>
                <TH>앱이름</TH>
                <TH>ref</TH>
                <TH className="w-40">Opt-In (beta)</TH>
                <TH className="w-40">Rollout Status (production)</TH>
                <TH className="w-24 text-right">active</TH>
              </TR>
            </THead>
            <TBody>
              {packages.map((p) => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs">{p.package}</TD>
                  <TD>{p.app_name ?? "—"}</TD>
                  <TD className="font-mono text-xs">{p.ref ?? "—"}</TD>
                  <TD>
                    <PackageOptInCell id={p.id} initial={p.opt_in} />
                  </TD>
                  <TD>
                    <PackageRolloutCell id={p.id} initial={p.rollout_status} />
                  </TD>
                  <TD className="text-right">
                    <ActiveToggle table="packages" id={p.id} active={p.active} />
                  </TD>
                </TR>
              ))}
              {packages.length === 0 && (
                <TR>
                  <TD colSpan={6} className="text-center text-gray-500">
                    등록된 패키지가 없습니다.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </section>
      </main>
    </>
  );
}
