// 인증 사용자용 공통 레이아웃 — NextAuth session 으로 가드, 사이드바 + 본문 영역
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div
        className="flex flex-1 flex-col overflow-hidden"
        data-user-email={session?.user?.email ?? ""}
      >
        {children}
      </div>
    </div>
  );
}
