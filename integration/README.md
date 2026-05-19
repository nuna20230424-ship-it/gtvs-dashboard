# GTVS Integration — SQLite Sink

gtvs_updater(Windows 작업 스케줄러로 매일 08:00, 18:00 실행되는 Python 업데이터)의 실행 결과를 같은 노트북의 `gtvs.db`(SQLite)에 직접 INSERT 하는 모듈이다. 기존 jsonl 로컬 기록과 메일 발송은 그대로 유지하고, DB 쓰기만 얹는다.

> 이전 버전(`supabase_sink.py`)은 Supabase REST 로 전송했으나, 노트북 단독 운영으로 전환됨에 따라 SQLite 직접 INSERT 로 교체. 함수 시그니처는 동일하게 유지 (`push_update_records`, `push_version_history`, `flush_pending_queue`).

## 무엇을 하는가

- `update_records.jsonl` 추가분 → `update_records` 테이블 batch INSERT.
- `version_history.jsonl` 추가분 → `version_history` 테이블 batch INSERT.
- DB 락/디스크 실패 시 `pending_upload.jsonl` 큐에 떨군다. 다음 실행 시작 때 재시도.
- 외부 의존성: `python-dotenv` 만. SQLite 는 표준 라이브러리.

## 셋업

```powershell
cd C:\GTVS\dashboard\integration
pip install -r requirements.txt
copy .env.example .env
```

`.env` 는 그대로 두면 됨 (기본 경로 `C:/GTVS/dashboard/db/gtvs.db`). DB 위치를 옮겼다면 `GTVS_DB_PATH` 만 수정.

`gtvs.db` 가 아직 없다면 먼저 `docs/laptop-setup.md` 의 2단계로 DB 초기화.

## 동작 검증 (dry-run)

```powershell
# 가짜 UpdateRecord 3개를 update_records 테이블에 INSERT
python dry_run.py --records 3

# 가짜 version_history 항목 2개 INSERT
python dry_run.py --history 2

# 보류 큐 재시도
python dry_run.py --flush

# 동시에 모두
python dry_run.py --records 3 --history 2 --flush
```

성공 시 stdout 에 `update_records 전송: 요청 3건 / 성공 3건` 처럼 표시. Next.js 대시보드 `/records`, `/history` 에서 행이 보여야 한다.

테스트 더미 데이터는 `STB-DRY-01`, `STB-DRY-02` device, `com.dry.test.*` package 로 들어가니 검증 후 SQL 로 정리.

```sql
-- sqlite3 C:/GTVS/dashboard/db/gtvs.db
delete from update_records where device like 'STB-DRY-%';
delete from version_history where device like 'STB-DRY-%';
```

또는 Python 한 줄.

```powershell
python -c "import sqlite3; c = sqlite3.connect('C:/GTVS/dashboard/db/gtvs.db'); c.execute(\"delete from update_records where device like 'STB-DRY-%'\"); c.execute(\"delete from version_history where device like 'STB-DRY-%'\"); c.commit(); c.close(); print('OK')"
```

## 기존 main.py 연동

`patch_main.md` 에 정확한 diff. 요약.

1. main.py 상단에 sink 모듈 import 3줄 추가 (모듈명 `sqlite_sink`).
2. `run_check()` 시작 부분에서 `flush_pending_queue()` 호출.
3. `run_check()` 안 `_save_history()` 다음에 `push_update_records(records)` 호출.
4. `_update_version_tracking()` 안 `if new_entries:` 블록 끝에 `push_version_history(new_entries)` 호출.

총 7줄 추가, 기존 라인 수정 없음.

## 트러블슈팅

| 증상 | 원인 | 대응 |
|------|------|------|
| stderr `GTVS_DB_PATH 미설정` | `.env` 누락 또는 변수 오타 | `.env` 파일이 `integration/` 디렉토리에 있고 `GTVS_DB_PATH=...` 가 있는지 확인 |
| stderr `DB 파일 없음: ...` | `gtvs.db` 미생성 | `docs/laptop-setup.md` 2단계 명령으로 DB 초기화 |
| stderr `... INSERT 실패: database is locked` | dev 서버가 긴 트랜잭션을 잡고 있음 (드물게) | sink 가 한 번 재시도 후 큐로 떨굼. 다음 실행 시 비워짐. |
| stderr `... DB 오류: ...` | 스키마 불일치 또는 디스크 가득 참 | `001_init.sql` 적용 여부, 디스크 여유 확인 |
| `pending_upload.jsonl` 이 계속 안 비워짐 | DB 오류가 지속 | stderr 로그에서 원인 확인. 큐 파일을 직접 열어 한 줄씩 살펴볼 수 있음. |
| 대시보드에 행이 안 보임 | Next.js 가 다른 DB 를 보고 있음 | `web/.env.local` 의 `DB_PATH` 와 `integration/.env` 의 `GTVS_DB_PATH` 가 동일한 파일을 가리키는지 확인 |

## 파일 구조

```
integration/
├── sqlite_sink.py      # 핵심 sink 모듈 (SQLite 직접 INSERT + 큐 관리)
├── dry_run.py          # CLI 검증 진입점
├── pending_upload.jsonl # 실패한 INSERT 의 보류 큐 (자동 생성/삭제)
├── .env                # GTVS_DB_PATH (gitignore 대상)
├── .env.example        # .env 템플릿
├── requirements.txt
├── patch_main.md       # gtvs_updater/main.py 수정 가이드 (diff 포함)
└── README.md           # 이 파일
```

## 설계 메모

- `pending_upload.jsonl` 은 single source of truth 로서의 로컬 jsonl 과는 별개의 임시 큐다. 비워지면 파일째 삭제됨.
- sink 함수는 어떤 예외도 던지지 않는다. 호출자는 try/except 불필요.
- batch INSERT 1회 트랜잭션. 부분 실패 없음 (SQLite executemany + with conn 트랜잭션).
- `sqlite3.OperationalError: database is locked` 는 WAL 모드라 거의 발생 안 함. 발생 시 0.5초 sleep 후 1회 재시도.
- DB 연결은 호출 단위로 open/close (커넥션 풀 없음). 빈도가 낮아 무관.
