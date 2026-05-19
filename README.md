# GTVS Dashboard

GTVS 패키지(beta/production) 버전 업데이트 이력을 Supabase에 저장하고
Next.js 대시보드에서 조회한다.

## 구성

```
dashboard/
├── docs/                   # 계획, 셋업 가이드
│   ├── plan.md
│   └── supabase-setup.md
├── supabase/               # SQL 마이그레이션, RLS
│   └── migrations/
├── web/                    # Next.js 대시보드
├── integration/            # gtvs_updater ↔ Supabase 통합 (Python)
├── checklist.md            # 진행 상황
└── context-notes.md        # 결정 이력
```

## 빠른 시작

1. `docs/supabase-setup.md` 따라 Supabase 프로젝트 생성
2. `supabase/migrations/001_init.sql` 실행
3. `web/.env.local`, `integration/.env` 작성
4. `cd web && npm install && npm run dev` → http://localhost:3000
5. `integration/README.md` 따라 기존 `gtvs_updater/main.py`에 통합

## 진행 상황은 `checklist.md`, 의사결정 배경은 `context-notes.md` 참고
