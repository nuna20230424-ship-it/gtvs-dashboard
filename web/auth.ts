// NextAuth 풀 설정 — Credentials Provider 에서 users 테이블 + bcrypt 검증 (Node runtime 전용)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import authConfig from "./auth.config";
import { db } from "@/lib/db";

type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  display_name: string | null;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const row = db
          .prepare(
            "select id, email, password_hash, display_name from users where email = ?"
          )
          .get(email) as UserRow | undefined;
        if (!row) return null;

        const ok = await compare(password, row.password_hash);
        if (!ok) return null;

        return {
          id: String(row.id),
          email: row.email,
          name: row.display_name ?? row.email,
        };
      },
    }),
  ],
});
