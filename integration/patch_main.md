# gtvs_updater/main.py 패치 가이드

`C:\Users\k251110\Desktop\qa-automation\gtvs_updater\main.py`에 아래 3 군데를 추가하면 매 실행마다 결과가 Supabase로도 미러링된다. 기존 jsonl 기록과 메일 발송 로직은 그대로 유지된다.

## 적용 원칙

- Supabase 호출은 sink 함수 내부에서 모든 예외를 잡고 큐로 떨군다. 호출자는 try/except 불필요.
- 호출 위치는 항상 **로컬 파일 기록 다음**. 로컬 jsonl이 single source of truth.
- 추가 라인 수: **총 7줄** (import 3줄 + flush 호출 1줄 + push 호출 3줄).

## 1) 모듈 import 추가 (파일 상단)

기존 24-25번 라인 (`from updater import ...`, `from reporter import ...`) 바로 아래에 sink import 1블록을 추가한다. `integration/` 디렉토리를 sys.path에 추가하는 방식이다.

```diff
 from updater import run_update_check
 from reporter import send_update_report
+
+# Supabase 미러링 sink (대시보드용). integration/ 디렉토리는 별도 위치에 존재.
+sys.path.insert(0, r"C:\GTVS\dashboard\integration")
+from supabase_sink import push_update_records, push_version_history, flush_pending_queue
```

> 경로를 환경변수로 빼고 싶다면 `os.getenv("GTVS_INTEGRATION_DIR", r"C:\GTVS\dashboard\integration")`로 치환.

## 2) `_update_version_tracking()` 안의 version_history push

기존 94-98번 라인 (`if new_entries: ... print(...)`) 블록 끝에 push 호출 1줄을 추가한다.

```diff
     if new_entries:
         with open(_VERSION_HISTORY_PATH, "a", encoding="utf-8") as f:
             for e in new_entries:
                 f.write(json.dumps(e, ensure_ascii=False) + "\n")
         print(f"버전 변경 {len(new_entries)}건 기록.")
+        push_version_history(new_entries)
```

- `new_entries`가 비어 있으면 호출 자체를 스킵 (이미 if 블록 안에 있음).
- push 실패 시 sink가 자체적으로 큐에 떨궈서 다음 실행 때 재시도한다.

## 3) `run_check()` 안의 update_records push + 시작 시 큐 플러시

기존 106-127번 라인의 `run_check()`에서 2 군데를 수정한다.

```diff
 def run_check() -> None:
     config = _load_config()
     now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
     print(f"\n[{now}] 업데이트 체크 시작.")
+
+    # 이전 실행에서 Supabase 전송 실패한 보류 큐 먼저 비우기
+    flush_pending_queue()

     records = run_update_check(
         config["devices"],
         config["packages"],
         load_wait=config.get("playstore_load_wait_sec", 5),
         update_timeout=config.get("update_timeout_sec", 300),
     )
     _save_history(records)
+    push_update_records(records)
     _update_version_tracking(records)
```

- `_save_history()`로 로컬 jsonl을 먼저 쓰고 그 다음 Supabase로 push.
- `flush_pending_queue()`는 매 실행 시작에서 1회. 실패 시에도 조용히 통과.

## 변경 라인 수 요약

| 위치 | 라인 추가 | 라인 수정 |
|------|----------|----------|
| import 블록 (line 25 직후) | 3 | 0 |
| `_update_version_tracking()` line 98 직후 | 1 | 0 |
| `run_check()` line 109 직후 | 2 (빈 줄 포함) | 0 |
| `run_check()` line 117 직후 | 1 | 0 |
| **합계** | **7줄** | **0줄** |

기존 로직(jsonl 저장, 스냅샷 갱신, 메일 발송)은 한 글자도 건드리지 않는다.

## 검증 순서

1. `integration/.env`에 Supabase URL/Key 채우기.
2. `cd C:\GTVS\dashboard\integration && python dry_run.py --records 3 --history 2`로 sink 단독 검증.
3. main.py에 위 diff 반영.
4. `python C:\Users\k251110\Desktop\qa-automation\gtvs_updater\main.py --once`로 1회 실행.
5. Supabase 대시보드에서 `update_records`, `version_history` 테이블에 행이 들어왔는지 확인.
6. 의도적으로 잘못된 URL을 넣고 다시 실행 → `integration/pending_upload.jsonl` 생성 확인 → URL 복구 후 재실행 → 큐가 비워지는지 확인.
