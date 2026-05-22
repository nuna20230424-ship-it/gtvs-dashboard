// 좌측 사이드바: 페이지 네비게이션 + 로그아웃 버튼
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  History,
  PlayCircle,
  RefreshCw,
  Settings,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/actions/auth";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/records", label: "Records", icon: ListChecks },
  { href: "/history", label: "History", icon: History },
  { href: "/updater", label: "Updater", icon: RefreshCw },
  { href: "/tests", label: "Tests", icon: PlayCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-white">
      <div className="px-4 py-5">
        <h1 className="text-lg font-semibold text-gray-900">GTVS</h1>
        <p className="text-xs text-gray-500">Dashboard</p>
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action={logout} className="border-t border-gray-200 p-2">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </form>
    </aside>
  );
}
