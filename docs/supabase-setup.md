# Supabase 프로젝트 셋업 가이드

처음 사용한다면 아래 절차를 따라주세요. 약 5분.

## 1. 가입 & 프로젝트 생성

1. https://supabase.com 접속 → "Start your project" → GitHub/Google 로그인
2. New project
   - Name: `gtvs-dashboard` (자유)
   - Database Password: 강한 비밀번호 (어딘가에 보관, 분실 시 재설정 가능)
   - Region: **Northeast Asia (Seoul)** 권장
   - Pricing Plan: Free
3. 프로젝트 생성 완료까지 2~3분 대기

## 2. 키 확인

생성 완료 후, **Project Settings → API** 메뉴에서 다음 4개 값을 확인.

- **Project URL** — `https://xxxxxxxx.supabase.co`
- **anon (public) key** — 브라우저에서 사용해도 안전한 키
- **service_role (secret) key** — 서버/Python에서 사용, **절대 브라우저에 노출 금지**
- **JWT Secret** — 일반적으로 안 씀

## 3. .env 파일 작성

### 3-1. `web/.env.local` (Next.js 용)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3-2. `integration/.env` (Python 용)

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

## 4. 스키마 적용

1. Supabase Dashboard → SQL Editor → "New query"
2. `supabase/migrations/001_init.sql` 내용을 붙여넣고 Run
3. Table editor에서 `devices`, `packages`, `update_records`, `version_history` 4개 테이블 생성 확인

## 5. 첫 사용자 만들기

대시보드 로그인용 계정 생성.

1. Supabase Dashboard → Authentication → Users → "Add user" → "Create new user"
2. 이메일/비밀번호 입력 (Auto Confirm User 체크)
3. 이 계정으로 Next.js 대시보드에서 로그인 가능

## 6. RLS 확인 (선택)

- Authentication → Policies에서 4개 테이블 모두 RLS Enabled & authenticated 읽기 정책 존재 확인
- `update_records` / `version_history`의 INSERT는 service_role만 허용 (Python에서 사용)

## 트러블슈팅

- **로그인 안 됨**: Auto Confirm User 체크 안 했다면 Authentication → Users → 해당 유저 → "Send Magic Link" 또는 이메일 컨펌 필요
- **403 RLS error**: 클라이언트가 anon key로 INSERT 시도 → 의도된 차단. Python은 service_role 사용 확인
- **CORS error**: Project Settings → API → "Site URL"에 `http://localhost:3000` 추가
