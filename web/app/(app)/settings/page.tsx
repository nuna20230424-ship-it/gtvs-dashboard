// 설정 페이지: 단말/패키지 목록과 active 토글
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { ActiveToggle } from "./active-toggle";
import { trackBadgeClass } from "@/lib/format";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: devices }, { data: packages }] = await Promise.all([
    supabase
      .from("devices")
      .select("id,name,track,ip,port,active")
      .order("track")
      .order("name"),
    supabase
      .from("packages")
      .select("id,package,app_name,ref,active")
      .order("package"),
  ]);

  return (
    <>
      <Header title="Settings" email={user?.email} />
      <main className="flex-1 space-y-8 overflow-auto p-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">단말 (devices)</h3>
          <Table>
            <THead>
              <TR>
                <TH>이름</TH>
                <TH>track</TH>
                <TH>IP</TH>
                <TH>port</TH>
                <TH className="w-24 text-right">active</TH>
              </TR>
            </THead>
            <TBody>
              {(devices ?? []).map((d) => (
                <TR key={d.id}>
                  <TD>{d.name}</TD>
                  <TD>
                    <Badge className={trackBadgeClass(d.track)}>{d.track}</Badge>
                  </TD>
                  <TD className="font-mono text-xs">{d.ip ?? "—"}</TD>
                  <TD className="font-mono text-xs">{d.port ?? "—"}</TD>
                  <TD className="text-right">
                    <ActiveToggle
                      table="devices"
                      id={d.id}
                      active={d.active}
                    />
                  </TD>
                </TR>
              ))}
              {(!devices || devices.length === 0) && (
                <TR>
                  <TD colSpan={5} className="text-center text-gray-500">
                    등록된 단말이 없습니다.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">패키지 (packages)</h3>
          <Table>
            <THead>
              <TR>
                <TH>패키지</TH>
                <TH>앱이름</TH>
                <TH>ref</TH>
                <TH className="w-24 text-right">active</TH>
              </TR>
            </THead>
            <TBody>
              {(packages ?? []).map((p) => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs">{p.package}</TD>
                  <TD>{p.app_name ?? "—"}</TD>
                  <TD className="font-mono text-xs">{p.ref ?? "—"}</TD>
                  <TD className="text-right">
                    <ActiveToggle
                      table="packages"
                      id={p.id}
                      active={p.active}
                    />
                  </TD>
                </TR>
              ))}
              {(!packages || packages.length === 0) && (
                <TR>
                  <TD colSpan={4} className="text-center text-gray-500">
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
