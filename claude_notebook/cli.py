"""claude-notebook CLI — `claude-notebook --workspace ~/myproject`.

Launches Jupyter Notebook 6.x with the claude-notebook extension auto-loaded
on the requested port + workspace dir.

Security defaults:
- ip = 127.0.0.1 (localhost only). Change to 0.0.0.0 explicitly for LAN.
- token/password from ~/.jupyter (Jupyter's own config). Don't disable.
"""

import argparse
import json
import os
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="claude-notebook",
        description="Single-user web workspace for claude code (multi-host SSH).",
    )
    ap.add_argument(
        "--workspace", "-w",
        default=os.getcwd(),
        help="root directory exposed in the file tree (default: current dir)",
    )
    ap.add_argument(
        "--port", "-p",
        type=int, default=8888,
        help="HTTP port (default 8888)",
    )
    ap.add_argument(
        "--ip",
        default="127.0.0.1",
        help="bind address. SECURITY: 0.0.0.0 exposes SSH-capable workspace "
             "to the entire network. Use only on trusted networks (Tailscale, "
             "VPN) and keep Jupyter token/password ON. Default: 127.0.0.1.",
    )
    ap.add_argument(
        "--no-token-warning",
        action="store_true",
        help="suppress token-not-set warning (still recommended to use one)",
    )
    args = ap.parse_args()

    workspace = Path(args.workspace).expanduser().resolve()
    if not workspace.is_dir():
        print(f"workspace not a directory: {workspace}", file=sys.stderr)
        return 2

    # Jupyter 6.x 의 dict trait 는 CLI argv 로 안전 전달 안 됨 → 임시 config.
    # `--config FILE` 은 그 파일만 사용 → user 의 ~/.jupyter password/token 이
    # 무시됨. 임시 config 안에서 user config 의 핵심 fields (password, token)
    # 를 import 해서 보존 (codex round 8).
    user_cfg = Path("~/.jupyter/jupyter_notebook_config.json").expanduser()
    user_settings = {}
    if user_cfg.is_file():
        try:
            user_settings = json.loads(user_cfg.read_text(encoding="utf-8")) or {}
        except Exception:
            pass
    nb_user = user_settings.get("NotebookApp", {})
    user_password = nb_user.get("password")
    user_token = nb_user.get("token")
    user_base_url = nb_user.get("base_url")
    # 진입점을 claude-notebook 앱으로 고정. 미설정 시 Jupyter 기본값은
    # `/tree` (raw 파일 브라우저) 라서 base_url 루트로 들어오면 (특히 모바일
    # 에서 호스트만 북마크한 경우) claude-notebook UI 가 아니라 헤더 없는
    # 순정 Jupyter tree/terminal 로 떨어진다. default_url 을 앱으로 잡으면
    # 모든 진입점이 앱으로 redirect 되고, `/tree` 는 직접 치면 여전히 접근 가능.
    user_default_url = nb_user.get("default_url")

    cfg_fd, cfg_path = tempfile.mkstemp(prefix="cn-", suffix="_config.py", text=True)
    try:
        with os.fdopen(cfg_fd, "w") as f:
            f.write('c = get_config()\n')
            f.write('c.NotebookApp.nbserver_extensions = {"claude_notebook": True}\n')
            if user_password:
                f.write(f'c.NotebookApp.password = {user_password!r}\n')
            if user_token is not None:
                f.write(f'c.NotebookApp.token = {user_token!r}\n')
            if user_base_url:
                f.write(f'c.NotebookApp.base_url = {user_base_url!r}\n')
            # default_url 은 base_url 기준 상대경로 → Jupyter 가 base_url 을
            # 앞에 붙인다 (예: base /notebook + /claude-notebook = /notebook/claude-notebook).
            f.write(f'c.NotebookApp.default_url = {(user_default_url or "/claude-notebook")!r}\n')
            # CN_REMOTE_ACCESS_FORWARD_v1
            # When bound to 127.0.0.1 + reverse-proxied, Jupyter's DNS-rebinding
            # guard 403's any request whose Host header isn't localhost.
            # tailnet auth already covers external trust, so disable the guard.
            if nb_user.get('allow_remote_access'):
                f.write('c.NotebookApp.allow_remote_access = True\n')
            _lh = nb_user.get('local_hostnames')
            if _lh:
                f.write(f'c.NotebookApp.local_hostnames = {list(_lh)!r}\n')
            if nb_user.get('disable_check_xsrf'):
                f.write('c.NotebookApp.disable_check_xsrf = True\n')

        cmd = [
            sys.executable, "-m", "notebook",
            "--no-browser",
            f"--config={cfg_path}",
            f"--ip={args.ip}",
            f"--port={args.port}",
            f"--notebook-dir={workspace}",
            f"--NotebookApp.port_retries=0",
        ]
        # Friendly banner
        print("=" * 60)
        print(f"  claude-notebook  workspace = {workspace}")
        print(f"  → http://{args.ip}:{args.port}/claude-notebook")
        if args.ip == "0.0.0.0" and not args.no_token_warning:
            print()
            print("  ⚠ SECURITY: bound to 0.0.0.0. Anyone on this network can")
            print("    reach the SSH-capable workspace. Use only with Tailscale/VPN")
            print("    + a strong Jupyter token/password.")
        print("=" * 60)
        print(f"  cmd: {' '.join(shlex.quote(c) for c in cmd)}")
        print("=" * 60, flush=True)
        return subprocess.call(cmd)
    finally:
        # 임시 config 파일 정리 (codex round 8: /tmp 누적 방지)
        try: os.unlink(cfg_path)
        except OSError: pass


if __name__ == "__main__":
    sys.exit(main())
