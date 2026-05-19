# gtvs_updater 결과를 Supabase REST API로 미러링하는 sink 모듈

from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable

import requests
from dotenv import load_dotenv

_BASE_DIR = Path(__file__).parent
_PENDING_PATH = _BASE_DIR / "pending_upload.jsonl"
_TIMEOUT = 10

# .env는 모듈 import 시점에 1회 로드. 호출자가 별도로 호출할 필요 없음.
load_dotenv(_BASE_DIR / ".env")


def _env() -> tuple[str, str] | None:
    """Supabase 접속 정보. 없으면 None."""
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None
    return url, key


def _log(msg: str) -> None:
    print(f"[supabase_sink] {msg}", file=sys.stderr)


def _headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _enqueue(table: str, rows: list[dict]) -> None:
    """Supabase 호출 실패 행을 로컬 큐에 append."""
    try:
        with open(_PENDING_PATH, "a", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps({"table": table, "row": row}, ensure_ascii=False) + "\n")
    except OSError as e:
        _log(f"큐 파일 쓰기 실패: {e}")


def _post(table: str, rows: list[dict]) -> bool:
    """단일 batch POST. 성공 시 True, 실패 시 False (호출자가 큐 처리)."""
    env = _env()
    if env is None:
        _log("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 — 큐로 우회.")
        return False
    url, key = env
    endpoint = f"{url}/rest/v1/{table}"
    try:
        resp = requests.post(
            endpoint,
            headers=_headers(key),
            data=json.dumps(rows, ensure_ascii=False).encode("utf-8"),
            timeout=_TIMEOUT,
            verify=True,
        )
        if resp.status_code in (200, 201, 204):
            return True
        _log(f"{table} POST 실패 status={resp.status_code} body={resp.text[:200]}")
        return False
    except requests.RequestException as e:
        _log(f"{table} 네트워크 오류: {e}")
        return False


def _record_to_row(record: Any) -> dict:
    """UpdateRecord dataclass → update_records 행."""
    d = asdict(record) if is_dataclass(record) else dict(record)
    return {
        "device": d.get("device", ""),
        "track": d.get("track", "unknown"),
        "package": d.get("package", ""),
        "ref": d.get("ref", "") or "",
        "app_name": d.get("app_name", "") or "",
        "status": d.get("status", "error"),
        "version_before": d.get("version_before"),
        "version_after": d.get("version_after"),
        "error": d.get("error"),
        "checked_at": d.get("timestamp"),
    }


def _history_to_row(entry: dict) -> dict:
    """new_entries dict → version_history 행."""
    return {
        "device": entry.get("device", ""),
        "track": entry.get("track", "unknown"),
        "package": entry.get("package", ""),
        "app_name": entry.get("app_name", "") or "",
        "version_before": entry.get("version_before"),
        "version_after": entry.get("version_after", ""),
        "source": entry.get("source", "auto"),
        "changed_at": entry.get("timestamp"),
    }


def push_update_records(records: Iterable[Any]) -> int:
    """update_records 테이블에 batch INSERT. 성공 행 수 반환. 실패 시 큐로."""
    rows = [_record_to_row(r) for r in records]
    if not rows:
        return 0
    if _post("update_records", rows):
        return len(rows)
    _enqueue("update_records", rows)
    return 0


def push_version_history(entries: Iterable[dict]) -> int:
    """version_history 테이블에 batch INSERT. 성공 행 수 반환. 실패 시 큐로."""
    rows = [_history_to_row(e) for e in entries]
    if not rows:
        return 0
    if _post("version_history", rows):
        return len(rows)
    _enqueue("version_history", rows)
    return 0


def flush_pending_queue() -> int:
    """보류 큐 재시도. 전부 성공하면 파일 삭제, 일부 실패면 실패분만 다시 저장.
    반환값: 이번 호출로 Supabase에 들어간 행 수."""
    if not _PENDING_PATH.exists():
        return 0

    # 큐 파일 읽기
    try:
        with open(_PENDING_PATH, "r", encoding="utf-8") as f:
            lines = [ln.strip() for ln in f if ln.strip()]
    except OSError as e:
        _log(f"큐 파일 읽기 실패: {e}")
        return 0

    # 테이블별로 그룹핑
    grouped: dict[str, list[dict]] = {}
    for ln in lines:
        try:
            obj = json.loads(ln)
            grouped.setdefault(obj["table"], []).append(obj["row"])
        except (json.JSONDecodeError, KeyError):
            continue

    if not grouped:
        try:
            _PENDING_PATH.unlink()
        except OSError:
            pass
        return 0

    sent = 0
    remaining: list[tuple[str, dict]] = []
    for table, rows in grouped.items():
        if _post(table, rows):
            sent += len(rows)
        else:
            remaining.extend((table, r) for r in rows)

    # 큐 파일 재작성 (성공분 제거)
    try:
        if remaining:
            with open(_PENDING_PATH, "w", encoding="utf-8") as f:
                for table, row in remaining:
                    f.write(json.dumps({"table": table, "row": row}, ensure_ascii=False) + "\n")
        else:
            _PENDING_PATH.unlink()
    except OSError as e:
        _log(f"큐 파일 갱신 실패: {e}")

    return sent
