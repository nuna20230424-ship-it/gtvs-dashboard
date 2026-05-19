// 루트 레이아웃: 글로벌 CSS 로드 및 토스트 Provider 주입
import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "GTVS Dashboard",
  description: "Google TV 단말 자동 업데이트 시스템 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
