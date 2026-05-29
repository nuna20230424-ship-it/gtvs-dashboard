# gtvs_updater → scenario_runner 자동 트리거 통합 가이드

매 GTVS 업데이트 체크 후, `status='updated'` 인 (device, package) 조합에 대해 자동으로
`scenario_runner.py` 를 실행해 자동 시나리오를 돌리고 결과를 `gtvs.db.test_runs` 에 누적시키는 패치.

- **대상 파일** — `qa-automation/gtvs_updater/main.py`
- **추가 위치** — `run_check()` 안의 `_update_version_tracking(records)` 직후
- **결과** — 업데이트 발생한 패키지만 시나리오 자동 실행. 비동기(Popen)라 메일 발송 지연 없음.
- **사용자 환경 요구** — `gtvs.db` 가 dashboard 측 `GTVS_DB_PATH` 환경변수로 가리키는 경로에 존재.

---

## 1. import 추가 (파일 상단)

`main.py` 의 기존 import 블록에 다음 두 줄을 추가합니다 (이미 있으면 생략).

```python
import subprocess
from pathlib import Path
```

## 2. 헬퍼 함수 신규 추가 (모듈 최상위)

`_update_version_tracking` 정의 아래, `run_check` 위에 다음 함수를 추가합니다.

```python
def _trigger_scenarios(records: list, config: dict) -> None:
    """status='updated' 인 (device, package) 마다 scenario_runner 를 비동기 실행.
    실행 결과는 scenario_runner 내부에서 gtvs.db test_runs 테이블에 INSERT 된다.
    실패해도 메일 발송 흐름은 멈추지 않게 try/except 로 격리.
    """
    runner = Path(__file__).parent / "scenario_runner.py"
    device_map = {d["name"]: d for d in config.get("devices", [])}
    triggered = 0
    for r in records:
        if r.status != "updated":
            continue
        dev = device_map.get(r.device)
        if not dev:
            continue
        adb_target = f"{dev['ip']}:{dev['port']}"
        try:
            subprocess.Popen(
                [
                    sys.executable, str(runner),
                    "--device", adb_target,
                    "--device-name", r.device,
                    "--ref", r.ref,
                    "--triggered-by", "auto",
                ],
                cwd=str(Path(__file__).parent.parent),
                creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
            )
            triggered += 1
        except Exception as e:
            print(f"[scenario] {r.device}/{r.ref} 트리거 실패: {e}")
    if triggered:
        print(f"[scenario] 자동 시나리오 {triggered}건 비동기 트리거.")
```

## 3. `run_check` 안에서 호출 (한 줄 추가)

```python
def run_check() -> None:
    config = _load_config()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{now}] 업데이트 체크 시작.")

    records = run_update_check(...)
    _save_history(records)
    _update_version_tracking(records)

    # ↓ 신규 — 업데이트 발생한 (device, package) 에 한해 시나리오 자동 트리거
    _trigger_scenarios(records, config)

    updated = [r for r in records if r.status == "updated"]
    ...
```

## 4. (옵션) risky 시나리오 자동 실행 제외 확인

scenario_runner 는 기본 `--include-risky` 없이 호출되므로, `risky: true` 로 표기된 자동 step
(현재는 TvCoreServices 의 `boot_time_measure` — STB 재부팅) 은 자동 트리거에서 자동으로 건너뜁니다.
대시보드 UI "Run + Risky" 버튼으로만 실행됩니다.

## 5. 검증 절차

1. 위 3개 변경(import / 함수 / 호출 한 줄) 적용 후 저장.
2. 1회 수동 실행으로 검증.
   ```powershell
   cd C:\Users\k251110\Desktop\qa-automation
   python gtvs_updater\main.py --once
   ```
3. 출력에 `[scenario] 자동 시나리오 N건 비동기 트리거.` 가 보이면 성공 (N = updated 레코드 수).
4. 잠시 대기 후 대시보드 `localhost:3000/tests` → 셀에 새 `auto` 트리거 결과 row 누적 확인.

## 6. 동작 흐름 요약

```
[gtvs_updater/main.py run_check()]
  ↓
[run_update_check] — adb 로 18개 패키지 × 2단말 업데이트 체크
  ↓
[_save_history] — update_history.jsonl 기록
  ↓
[_update_version_tracking] — version_snapshot/history.jsonl + gtvs.db update_records 갱신
  ↓
[_trigger_scenarios] — status='updated' 만 추려 비동기 Popen 으로 scenario_runner 호출
  └─→ scenario_runner — yaml 로드 → step 실행 → test_runs INSERT (백그라운드 진행)
  ↓
[reporter] — 이메일 발송 (시나리오 결과는 기다리지 않음)

대시보드 /tests 페이지는 매 진입마다 test_runs 최신 row 를 쿼리해서 셀 결과로 표시.
```

## 7. 비동기/동기 선택 시 트레이드오프

기본은 비동기(Popen)로 메일 발송이 즉시 진행됩니다. 동기로 바꾸려면 `Popen` 을 `run` 으로 교체.

| 방식 | 장점 | 단점 |
|---|---|---|
| **Popen 비동기 (기본)** | 메일 즉시 발송, run_check 동작 빠름 | 시나리오 실패해도 메일 본문에 반영 안 됨 (다음 사이클 후 결과 확인) |
| `subprocess.run` 동기 | 메일에 시나리오 결과 같이 포함 가능 | run_check 가 수 분 ~ 십수 분 지연 |

운영 시 메일 본문에 시나리오 요약을 포함하고 싶으면 동기로 바꾸고 `reporter.py` 에 결과 섹션 추가 (PT3 Gemini D 기능과 연계 가능).

---

## 참고 — scenario_runner 단독 호출 (디버그용)

```powershell
# 단발 실행 + JSON 결과 stdout
python gtvs_updater\scenario_runner.py `
  --device 172.30.1.128:5555 `
  --device-name STB-01 `
  --ref Katniss `
  --triggered-by manual `
  --json

# risky 포함 (TvCoreServices boot 시간 측정 등)
python gtvs_updater\scenario_runner.py `
  --device 172.30.1.128:5555 `
  --device-name STB-01 `
  --ref TvCoreServices `
  --include-risky
```
