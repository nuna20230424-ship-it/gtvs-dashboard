// 로그인 페이지 — NextAuth Credentials Provider. 이미 인증되어 있으면 / 로 리다이렉트
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { login } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case "invalid":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "unknown":
      return "로그인 중 오류가 발생했습니다.";
    default:
      return null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  if (session) redirect("/");

  const err = errorMessage(searchParams.error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">GTVS Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">로그인하여 시작합니다.</p>
        </div>
        <form action={login} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              이메일
            </label>
            <Input name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              비밀번호
            </label>
            <Input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {err ? <p className="text-xs text-red-600">{err}</p> : null}
          <Button type="submit" className="w-full">
            로그인
          </Button>
        </form>
      </div>
    </div>
  );
}
