// NextAuth 기반 로그인/로그아웃 server actions
"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code =
        error.type === "CredentialsSignin" ? "invalid" : "unknown";
      redirect(`/login?error=${code}`);
    }
    // NEXT_REDIRECT 등 내부 동작 throw 는 re-throw 해야 정상 동작
    throw error;
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
