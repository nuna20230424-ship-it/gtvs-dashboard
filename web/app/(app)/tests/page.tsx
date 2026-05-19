// 자동화 테스트 트리거 페이지: 패키지×단말 그리드 (현재는 placeholder)
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { TestsGrid } from "./tests-grid";

export default async function TestsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: devices }, { data: packages }] = await Promise.all([
    supabase
      .from("devices")
      .select("id,name,track,active")
      .eq("active", true)
      .order("track")
      .order("name"),
    supabase
      .from("packages")
      .select("id,package,app_name,active")
      .eq("active", true)
      .order("package"),
  ]);

  return (
    <>
      <Header title="Tests" email={user?.email} />
      <main className="flex-1 overflow-auto p-6">
        <TestsGrid
          devices={(devices ?? []).map((d) => ({
            name: d.name,
            track: d.track,
          }))}
          packages={(packages ?? []).map((p) => ({
            package: p.package,
            app_name: p.app_name,
          }))}
        />
      </main>
    </>
  );
}
