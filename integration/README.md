# GTVS Integration — Supabase Sink

gtvs_updater(Windows 작업 스케줄러로 매일 08:00, 18:00 실행되는 Python 업데이터)의 실행 결과를 Supabase로 미러링하는 모듈이다. 기존 jsonl 로컬 기록과 메일 발송은 그대로 유지하고, Supabase로의 push만 얹는다.

## 무엇을 하는가

- `update_records.jsonl` 추가분 → Supabase `update_records` 테이블 batch INSERT.
- `version_history.jsonl` 추가분 → Supabase `version_history` 테이블 batch INSERT.
- 네트워크/인증 실패 시 `pending_upload.jsonl` 큐에 떨군다. 다음 실행 시작 때 재시도.
- 외부 의존성: `requests`, `python-dotenv`만 사용. supabase-py SDK는 의존성 최소화 차원에서 사용하지 않음.

## 셋업

```powershell
cd C:\GTVS\dashboard\integration
pip install -r requirements.txt
copy .env.example .env
# .env 편집해서 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 채우기
```

`SUPABASE_SERVICE_ROLE_KEY`는 Supabase 프로젝트 Settings → API → `service_role` 키. RLS를 우회하므로 절대 클라이언트에 노출하지 말 것.

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

성공 시 stdout에 `update_records 전송: 요청 3건 / 성공 3건`처럼 표시되고, Supabase 대시보드의 Table Editor에서 행이 보여야 한다.

테스트 더미 데이터는 `STB-DRY-01`, `STB-DRY-02` device, `com.dry.test.*` package로 들어가니 검증 후 SQL로 정리:

```sql
delete from public.update_records where device like 'STB-DRY-%';
delete from public.version_history where device like 'STB-DRY-%';
```

## 기존 main.py 연동

`patch_main.md`에 정확한 diff가 있다. 요약:

1. main.py 상단에 sink 모듈 import 3줄 추가.
2. `run_check()` 시작 부분에서 `flush_pending_queue()` 호출.
3. `run_check()` 안 `_save_history()` 다음에 `push_update_records(records)` 호출.
4. `_update_version_tracking()` 안 `if new_entries:` 블록 끝에 `push_version_history(new_entries)` 호출.

총 7줄 추가, 기존 라인 수정 없음.

## 트러블슈팅

| 증상 | 원인 | 대응 |
|------|------|------|
| stderr `status=401` | API key 오타 / 만료 | `.env`의 `SUPABASE_SERVICE_ROLE_KEY` 재확인. `anon` 키가 아닌 `service_role` 키여야 함. |
| stderr `status=403` | RLS 정책 차단 | service_role 키는 RLS를 우회해야 정상. anon 키를 잘못 넣었거나 PostgREST 정책에서 service_role insert를 막아둔 경우. migration `001_init.sql`의 `*_insert_service` 정책 확인. |
| stderr `status=404` | URL 오타 또는 테이블 미존재 | `SUPABASE_URL`이 `https://xxxx.supabase.co` 형태인지, migration이 적용됐는지 확인. |
| stderr `네트워크 오류: ...` | 일시적 단절, DNS 실패 | 자동으로 `pending_upload.jsonl`에 큐잉. 다음 `run_check()` 시작 시 재시도. |
| `pending_upload.jsonl`이 계속 안 비워짐 | 인증/스키마 오류로 push가 매번 실패 | stderr 로그에서 status 코드 확인. 큐 파일을 직접 열어 한 줄씩 살펴볼 수 있음. |
| Supabase 응답이 200인데 행이 안 보임 | 다른 프로젝트에 INSERT 됨 | `.env`의 URL이 의도한 프로젝트 맞는지 확인. |

## 파일 구조

```
integration/
├── supabase_sink.py     # 핵심 sink 모듈 (REST API 호출 + 큐 관리)
├── dry_run.py           # CLI 검증 진입점
├── pending_upload.jsonl # 실패한 push의 보류 큐 (자동 생성/삭제)
├── .env                 # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (gitignore 대상)
├── .env.example         # .env 템플릿
├── requirements.txt
├── patch_main.md        # gtvs_updater/main.py 수정 가이드 (diff 포함)
└── README.md            # 이 파일
```

## 설계 메모

- `pending_upload.jsonl`은 single source of truth로서의 로컬 jsonl과는 별개의 임시 큐다. 비워지면 파일째 삭제됨.
- sink 함수는 어떤 예외도 던지지 않는다. 호출자는 try/except 불필요.
- batch INSERT 1회로 처리. 부분 실패 시 batch 전체를 큐에 떨군다 (PostgREST는 batch를 트랜잭션으로 처리).
- HTTPS 인증서 검증 ON (`verify=True`). timeout 10초.
