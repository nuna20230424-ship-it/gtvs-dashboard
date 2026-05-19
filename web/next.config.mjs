// Next.js 설정 — better-sqlite3 네이티브 모듈을 서버 컴포넌트 외부 패키지로 등록
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
