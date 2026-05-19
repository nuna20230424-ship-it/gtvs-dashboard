// 상단 헤더: 현재 페이지 제목 + 로그인 유저 이메일 표시
interface HeaderProps {
  title: string;
  email?: string | null;
}

export function Header({ title, email }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-500">{email ?? ""}</div>
    </header>
  );
}
