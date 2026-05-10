"""SSH-backed filesystem operations (Spec 3 — 원격 파일 트리 PoC).

subprocess + ssh ControlMaster 멀티플렉싱으로 원격 디렉토리 read.
~/.ssh/config 의 Host alias (jump-server, nhn 등) 그대로 사용.

Stage a (현재): list_dir 만. 응답 포맷은 local get_directory_listing 과 1:1 호환.
"""

import shlex
import subprocess
from pathlib import Path

# ControlMaster 멀티플렉싱 — 첫 SSH 연결만 느리고 이후는 ms 단위 (codex 권장)
CONTROL_PATH = "/tmp/cn-ssh-%r@%h:%p"
SKIP_NAMES = {".git", "__pycache__", "node_modules", ".venv", ".pytest_cache"}


def _ssh_base(host_id, timeout=30):
    """ssh 공통 옵션 — BatchMode (password prompt 차단) + ControlMaster."""
    return [
        "ssh",
        "-o", "BatchMode=yes",
        "-o", "ControlMaster=auto",
        "-o", f"ControlPath={CONTROL_PATH}",
        "-o", "ControlPersist=300",  # 5분 유지 — 5초 단위 유저 클릭에 충분
        "-o", f"ConnectTimeout={min(timeout, 15)}",
        host_id,
    ]


def _safe_subpath(sub_path):
    """path traversal 방지 — `..`, 절대경로, leading slash 금지."""
    if not sub_path:
        return ""
    if sub_path.startswith("/"):
        raise ValueError("absolute path not allowed")
    parts = sub_path.split("/")
    if any(p == ".." for p in parts):
        raise ValueError("'..' not allowed")
    return sub_path


def list_dir(host_id, sub_path=""):
    """원격 호스트 의 sub_path (HOME 기준) 디렉토리 1 레벨 list.

    Returns: [{name, path, type, mtime, size?, has_children?}, ...]
    응답 포맷은 local get_directory_listing 과 동일.

    Raises: ValueError (unsafe path), RuntimeError (ssh failure).
    """
    sub = _safe_subpath(sub_path)
    # 원격 target — sub 가 빈 문자열이면 $HOME, 아니면 $HOME/sub
    if sub:
        # shell quoting — 사용자가 가지고 있을 법한 공백/특수문자 안전 처리
        target = '"$HOME/' + sub.replace('"', '\\"') + '"'
    else:
        target = '"$HOME"'

    # find 의 -printf 로 atomic parsing — 줄당 type\tsize\tmtime\tname
    # %y = type char, %s = size, %T@ = mtime epoch, %f = name only (no path)
    remote_cmd = (
        f"find {target} -mindepth 1 -maxdepth 1 "
        f'-printf "%y\\t%s\\t%T@\\t%f\\n" 2>/dev/null | sort'
    )
    cmd = _ssh_base(host_id) + [remote_cmd]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"ssh timeout after 30s")
    if proc.returncode != 0:
        # 1 = path 없음, 255 = ssh 자체 fail
        msg = proc.stderr.strip()[:300] or proc.stdout.strip()[:300]
        raise RuntimeError(f"ssh exit {proc.returncode}: {msg}")

    items = []
    for line in proc.stdout.splitlines():
        parts = line.split("\t", 3)
        if len(parts) != 4:
            continue
        ty, size_s, mtime_s, name = parts
        if name in SKIP_NAMES:
            continue
        rel = f"{sub}/{name}" if sub else name
        try:
            mtime = float(mtime_s)
        except ValueError:
            mtime = None
        if ty == "d":
            items.append({
                "name": name,
                "path": rel,
                "type": "directory",
                "has_children": True,
                "mtime": mtime,
            })
        elif ty == "f":
            try:
                size = int(size_s)
            except ValueError:
                size = None
            items.append({
                "name": name,
                "path": rel,
                "type": "file",
                "mtime": mtime,
                "size": size,
            })
        # 'l' (symlink), 'p', 'b', 'c' 등은 PoC 단계에서 skip
    # local과 동일 정렬: 디렉토리 먼저, 이름 case-insensitive
    items.sort(key=lambda e: (e["type"] != "directory", e["name"].lower()))
    return items
