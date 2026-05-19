# supabase_sink 동작을 검증하는 CLI 더미 데이터 송신기

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from supabase_sink import (
    flush_pending_queue,
    push_update_records,
    push_version_history,
)


@dataclass
class _FakeRecord:
    """gtvs_updater.updater.UpdateRecord와 동일한 필드 (테스트용 사본)."""
    device: str
    track: str
    app_name: str
    package: str
    ref: str
    timestamp: str
    status: str
    version_before: Optional[str] = None
    version_after: Optional[str] = None
    error: Optional[str] = None


def _make_records(n: int) -> list[_FakeRecord]:
    ts = datetime.now().isoformat(timespec="seconds")
    out: list[_FakeRecord] = []
    for i in range(n):
        out.append(_FakeRecord(
            device=f"STB-DRY-{i % 2 + 1:02d}",
            track="beta" if i % 2 == 0 else "production",
            app_name=f"DryApp-{i}",
            package=f"com.dry.test.app{i}",
            ref=f"dry-app-{i}",
            timestamp=ts,
            status="updated" if i % 3 == 0 else "up_to_date",
            version_before="1.0.0",
            version_after="1.0.1" if i % 3 == 0 else None,
        ))
    return out


def _make_history(n: int) -> list[dict]:
    ts = datetime.now().isoformat(timespec="seconds")
    return [
        {
            "timestamp": ts,
            "device": f"STB-DRY-{i % 2 + 1:02d}",
            "track": "beta" if i % 2 == 0 else "production",
            "package": f"com.dry.test.app{i}",
            "app_name": f"DryApp-{i}",
            "version_before": "1.0.0",
            "version_after": "1.0.1",
            "source": "auto" if i % 2 == 0 else "manual",
        }
        for i in range(n)
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="Supabase sink 동작 검증")
    parser.add_argument("--records", type=int, default=0,
                        help="가짜 UpdateRecord N개 전송")
    parser.add_argument("--history", type=int, default=0,
                        help="가짜 version_history 항목 N개 전송")
    parser.add_argument("--flush", action="store_true",
                        help="pending_upload.jsonl 큐 재시도")
    args = parser.parse_args()

    if args.flush:
        sent = flush_pending_queue()
        print(f"큐 플러시 완료. Supabase 반영 행: {sent}")

    if args.records > 0:
        records = _make_records(args.records)
        ok = push_update_records(records)
        print(f"update_records 전송: 요청 {len(records)}건 / 성공 {ok}건")

    if args.history > 0:
        entries = _make_history(args.history)
        ok = push_version_history(entries)
        print(f"version_history 전송: 요청 {len(entries)}건 / 성공 {ok}건")

    if not (args.flush or args.records or args.history):
        parser.print_help()
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
