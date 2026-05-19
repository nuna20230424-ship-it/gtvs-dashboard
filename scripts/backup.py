# gtvs.db 일일 백업 스크립트 — SQLite online backup API 사용 + Google Drive 폴더로 복사 + 30일 이상 자동 삭제
# 사용: python scripts/backup.py
# Windows 작업 스케줄러에 등록해서 매일 새벽 3시 자동 실행

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

# 환경변수로 override 가능. 없으면 default 사용.
DB_PATH = Path(
    os.getenv("GTVS_DB_PATH", r"C:\GTVS\dashboard\db\gtvs.db")
)
BACKUP_DIR = Path(
    os.getenv(
        "GTVS_BACKUP_DIR",
        os.path.expanduser(r"~\Google 드라이브\내 드라이브\gtvs-backups"),
    )
)
RETENTION_DAYS = int(os.getenv("GTVS_BACKUP_RETENTION_DAYS", "30"))


def main() -> int:
    if not DB_PATH.exists():
        print(f"[backup] DB 없음: {DB_PATH}", file=sys.stderr)
        return 1

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    out_path = BACKUP_DIR / f"gtvs-{datetime.now().strftime('%Y%m%d')}.db"

    # SQLite online backup API — DB 가 락 걸려있어도 안전하게 복사
    src = sqlite3.connect(str(DB_PATH))
    dst = sqlite3.connect(str(out_path))
    try:
        with dst:
            src.backup(dst)
    finally:
        src.close()
        dst.close()

    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"[backup] OK: {out_path} ({size_mb:.2f} MB)")

    # 30일 이상 자동 삭제
    cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).timestamp()
    removed = 0
    for p in BACKUP_DIR.glob("gtvs-*.db"):
        if p.stat().st_mtime < cutoff:
            p.unlink()
            removed += 1
    if removed:
        print(f"[backup] 30일 이상 백업 {removed}개 삭제")

    return 0


if __name__ == "__main__":
    sys.exit(main())
