// NextAuth 기반 인증 가드 미들웨어 — edge runtime 호환 (auth.config 만 사용, DB 의존 없음)
import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
