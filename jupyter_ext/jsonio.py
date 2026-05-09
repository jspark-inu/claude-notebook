"""Atomic JSON write helper. Used by all config files in this extension."""
from __future__ import annotations
import json, os
from pathlib import Path


def write_json_atomic(path: Path, data) -> None:
    """Atomic JSON write: tmp file + os.replace (POSIX atomic)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(tmp, path)
