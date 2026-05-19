# GTVS Dashboard (Web)

Google TV 단말 자동 업데이트 시스템 GTVS의 모니터링/조작용 웹 대시보드입니다. Next.js 14 (App Router) + Supabase 기반.

## 요구 사항

- Node.js 18.17 이상
- Supabase 프로젝트 (URL, anon key)

## 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일을 열어 Supabase URL, anon key 입력

# 3. 개발 서버 실행
npm run dev
```

접속: <http://localhost:3000>

## 첫 사용자 생성

Supabase 콘솔의 Authentication → Users 메뉴에서 직접 이메일/비밀번호 사용자를 생성합니다. 회원가입 UI는 제공하지 않습니다.

## 페이지 구성

- `/login` — 이메일/비밀번호 로그인
- `/` — Overview. 단말 × 패키지 현재 버전 매트릭스
- `/records` — 업데이트 조회 기록 (필터 + 페이지네이션)
- `/history` — 버전 변경 이력 (필터)
- `/tests` — 자동화 테스트 트리거 그리드 (현재는 placeholder)
- `/settings` — 단말/패키지 목록과 active 토글

## 빌드

```bash
npm run build
npm run start
```
