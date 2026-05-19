// NextAuth edge-safe 기본 설정 — DB 의존 없음. middleware 와 auth.ts 의 공통 base
import type { NextAuthConfig } from "next-auth";

export default {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized: ({ request, auth }) => {
      const pathname = request.nextUrl.pathname;
      if (pathname === "/login") return true;
      if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api/auth") ||
        pathname === "/favicon.ico"
      ) {
        return true;
      }
      return !!auth?.user;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
