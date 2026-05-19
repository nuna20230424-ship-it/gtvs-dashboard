// 자동화 테스트 트리거 페이지 — 단말×패키지 그리드 (현재는 placeholder)
import { auth } from "@/auth";
import { Header } from "@/components/header";
import { TestsGrid } from "./tests-grid";
import { listActiveDevices, listActivePackages } from "@/lib/queries";

export default async function TestsPage() {
  const session = await auth();
  const devices = listActiveDevices();
  const packages = listActivePackages();

  return (
    <>
      <Header title="Tests" email={session?.user?.email ?? undefined} />
      <main className="flex-1 overflow-auto p-6">
        <TestsGrid
          devices={devices.map((d) => ({ name: d.name, track: d.track }))}
          packages={packages.map((p) => ({
            package: p.package,
            app_name: p.app_name,
          }))}
        />
      </main>
    </>
  );
}
