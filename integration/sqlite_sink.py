# gtvs_updater 결과를 SQLite(gtvs.db)에 직접 INSERT 하는 sink 모듈
# Supabase REST 의존을 제거하고 같은 노트북의 DB 파일을 사용한다.

from __future__ import annotations

import json
import os
import sqlite3
import sys
import time
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable

from dotenv import load_dotenv

_BASE_DIR = Path(__file__).parent
_PENDING_PATH = _BASE_DIR / "pending_upload.jsonl"
_RETRY_DELAY_SEC = 0.5

# .env 는 모듈 import 시 1회 로드. 호출자가 별도로 호출할 필요 없음.
load_dotenv(_BASE_DIR / ".env")


def _db_path() -> str | None:
    p = os.getenv("GTVS_DB_PATH", "").strip()
    return p or None


def _log(msg: str) -> None:
    print(f"[sqlite_sink] {msg}", file=sys.stderr)


def _connect() -> sqlite3.Connection | None:
    p = _db_path()
    if not p:
        _log("GTVS_DB_PATH 미설정 — 큐로 우회.")
        return None
    if not Path(p).exists():
        _log(f"DB 파일 없음: {p} — 큐로 우회.")
        return None
    return sqlite3.connect(p, timeout=10.0)


_INSERT_SQL = {
    "update_records": (
        "insert into update_records "
        "(device, track, package, ref, app_name, status, version_before, version_after, error, checked_at) "
        "values (:device, :track, :package, :ref, :app_name, :status, :version_before, :version_after, :error, :checked_at)"
    ),
    "version_history": (
        "insert into version_history "
        "(device, track, package, app_name, version_before, version_after, source, changed_at) "
        "values (:device, :track, :package, :app_name, :version_before, :version_after, :source, :changed_at)"
    ),
}


def _enqueue(table: str, rows: list[dict]) -> None:
    """INSERT 실패 시 로컬 큐에 append (다음 실행 시 flush 로 재시도)."""
    try:
        with open(_PENDING_PATH, "a", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps({"table": table, "row": row}, ensure_ascii=False) + "\n")
    except OSError as e:
        _log(f"큐 파일 쓰기 실패: {e}")


def _insert(table: str, rows: list[dict]) -> bool:
    """단일 배치 INSERT. 성공 시 True. 트랜잭션 단위라 부분 실패 없음."""
    sql = _INSERT_SQL.get(table)
    if not sql:
        _log(f"알 수 없는 테이블: {table}")
        return False
    conn = _connect()
    if conn is None:
        return False
    try:
        # SQLite 가 잠시 잠긴 경우 1회 재시도 (WAL 라 거의 발생 안 함)
        for attempt in range(2):
            try:
                with conn:
                    conn.executemany(sql, rows)
                return True
            except sqlite3.OperationalError as e:
                if "locked" in str(e).lower() and attempt == 0:
                    time.sleep(_RETRY_DELAY_SEC)
                    continue
                _log(f"{table} INSERT 실패: {e}")
                return False
        return False
    except sqlite3.DatabaseError as e:
        _log(f"{table} DB 오류: {e}")
        return False
    finally:
        conn.close()


def _record_to_row(record: Any) -> dict:
    """UpdateRecord dataclass → update_records 행. 기존 sink 와 동일한 매핑."""
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
    """update_records 에 batch INSERT. 성공 행 수 반환. 실패 시 큐로."""
    rows = [_record_to_row(r) for r in records]
    if not rows:
        return 0
    if _insert("update_records", rows):
        return len(rows)
    _enqueue("update_records", rows)
    return 0


def push_version_history(entries: Iterable[dict]) -> int:
    """version_history 에 batch INSERT. 성공 행 수 반환. 실패 시 큐로."""
    rows = [_history_to_row(e) for e in entries]
    if not rows:
        return 0
    if _insert("version_history", rows):
        return len(rows)
    _enqueue("version_history", rows)
    return 0


def flush_pending_queue() -> int:
    """보류 큐 재시도. 전부 성공하면 파일 삭제, 일부 실패면 실패분만 다시 저장.
    반환값: 이번 호출로 DB 에 들어간 행 수."""
    if not _PENDING_PATH.exists():
        return 0

    try:
        with open(_PENDING_PATH, "r", encoding="utf-8") as f:
            lines = [ln.strip() for ln in f if ln.strip()]
    except OSError as e:
        _log(f"큐 파일 읽기 실패: {e}")
        return 0

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
        if _insert(table, rows):
            sent += len(rows)
        else:
            remaining.extend((table, r) for r in rows)

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
