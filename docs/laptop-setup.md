# 노트북 단독 셋업 가이드 (SQLite + Next.js)

GTVS 대시보드를 본인 Windows 노트북 단독으로 운영하기 위한 가이드.
서버, 수집기, DB, 대시보드가 전부 같은 노트북 안에 머무름. 외부 통신 0건.

## 구조

```
C:\GTVS\
├── gtvs_updater\          (기존 — adb로 STB 체크하는 Python 스크립트)
└── dashboard\
    ├── db\
    │   ├── gtvs.db                ← SQLite 파일 (앞으로 생성)
    │   └── migrations\
    │       ├── 001_init.sql       ← 스키마
    │       └── 002_seed.sql       ← 초기 데이터
    ├── web\                       (Next.js — localhost:3000)
    └── integration\               (gtvs_updater ↔ gtvs.db 어댑터)
```

본 문서 범위 — **DB 파일 초기화까지 (Phase 2)**.
이후 Phase 3(Next.js Supabase 제거 + NextAuth 도입), Phase 4(Python sink 전환), Phase 5(운영 자동화) 는 별도 문서.

---

## 1단계. 사전 확인

PowerShell에서 다음 명령을 실행해 환경을 확인.

```powershell
node --version       # v18.17 이상 권장 (web/package.json engines 에 명시됨)
python --version     # 3.10 이상 권장 (기존 gtvs_updater 가 쓰는 버전과 동일)
```

둘 다 설치되어 있어야 함. 없으면 각각 nodejs.org / python.org에서 LTS 버전 설치.

Google Drive 클라이언트 — 이미 노트북에 있다고 가정. 동기화 폴더 경로만 확인.

```powershell
# 일반적으로 다음 중 하나
Test-Path "C:\Users\$env:USERNAME\Google Drive\내 드라이브"
Test-Path "G:\내 드라이브"
```

존재하는 경로를 메모 — 8단계 백업 셋업에서 사용.

---

## 2단계. SQLite DB 파일 생성

`gtvs.db`를 새로 만들고 스키마 + 시드를 적용한다. **sqlite3 CLI를 별도로 설치할 필요 없이 Python 표준 라이브러리로 처리** (Python은 어차피 노트북에 있음).

PowerShell에서.

```powershell
cd C:\GTVS\dashboard

python -c "import sqlite3, pathlib; db = pathlib.Path('db/gtvs.db'); db.parent.mkdir(parents=True, exist_ok=True); conn = sqlite3.connect(db); conn.executescript(open('db/migrations/001_init.sql', encoding='utf-8').read()); conn.executescript(open('db/migrations/002_seed.sql', encoding='utf-8').read()); conn.commit(); conn.close(); print('OK ->', db.resolve())"
```

출력 예시.

```
OK -> C:\GTVS\dashboard\db\gtvs.db
```

`C:\GTVS\dashboard\db\gtvs.db` 파일이 생성됨.

---

## 3단계. 스키마/시드/WAL 통합 검증

5개 테이블, 시드 데이터, WAL 모드를 한 번에 확인.

```powershell
python -c "import sqlite3; conn = sqlite3.connect('C:/GTVS/dashboard/db/gtvs.db'); cur = conn.cursor(); print('tables:', [r[0] for r in cur.execute(\"select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name\")]); print('devices:', cur.execute('select count(*) from devices').fetchone()[0]); print('packages:', cur.execute('select count(*) from packages').fetchone()[0]); print('journal_mode:', conn.execute('pragma journal_mode').fetchone()[0]); conn.close()"
```

기대 출력.

```
tables: ['devices', 'packages', 'update_records', 'users', 'version_history']
devices: 2
packages: 18
journal_mode: wal
```

이 4줄이 정확히 나오면 Phase 2 완료.

> 참고 — `sqlite_sequence`는 SQLite가 autoincrement 사용 시 자동 생성하는 내부 테이블. 위 쿼리에서 `name not like 'sqlite_%'`로 제외했음.

WAL 모드 덕분에 Python `gtvs_updater`의 INSERT와 Next.js의 SELECT가 서로 막지 않음. 노트북 단일 사용자 시나리오라 거의 무관해 보이지만, Next.js가 SELECT 길게 끄는 동안 Python 체크 사이클이 차단되는 일을 막아 줌.

---

## 완료 시점 체크

- [ ] `node --version`, `python --version` 둘 다 정상 출력
- [ ] Google Drive 동기화 폴더 경로 확인됨
- [ ] `C:\GTVS\dashboard\db\gtvs.db` 파일 존재
- [ ] 검증 명령 출력에 5개 테이블 + devices=2, packages=18
- [ ] `journal_mode: wal`

위 5개 모두 OK면 다음 Phase로 진행 가능.

---

## 다음 단계 (별도 문서 예정)

| Phase | 문서 | 작업 요약 |
|---|---|---|
| 3 | `docs/migration-to-sqlite.md` | Next.js `@supabase/*` 제거 + `better-sqlite3` + NextAuth + API Route. 기존 페이지/컴포넌트 UI는 유지 |
| 4 | `docs/python-sink-rewrite.md` | `integration/supabase_sink.py` 폐기, `sqlite_sink.py` 신규 (`sqlite3` 표준 라이브러리로 직접 INSERT) |
| 5 | `docs/laptop-operations.md` | Windows 작업 스케줄러로 (a) Next.js 자동 기동, (b) 일 1회 `.backup` → Google Drive |

이 가이드(Phase 2)가 완료된 후 위 3개 문서 작성 또는 Phase 3 코드 작업으로 곧장 진입 가능.
