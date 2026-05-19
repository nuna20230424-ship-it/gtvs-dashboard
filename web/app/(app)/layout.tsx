// 인증 사용자용 공통 레이아웃: 사이드바 + 헤더 자리 확보
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div
        className="flex flex-1 flex-col overflow-hidden"
        data-user-email={user?.email ?? ""}
      >
        {children}
      </div>
    </div>
  );
}
