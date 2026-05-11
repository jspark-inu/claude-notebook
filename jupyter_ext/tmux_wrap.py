"""
Wrap jupyter terminal PTYs in tmux sessions so the rendered scrollback
survives browser refresh / jupyter restart / tab close.

Strategy:
  - Each jupyter terminal name N maps to tmux session "cn-N".
  - On terminal creation we ensure a detached tmux session exists
    (has-session || new-session -d) and replace the PTY's shell_command
    with `tmux attach -t cn-N`. Attaching is cheap; the session keeps the
    shell + claude process alive even when no client is attached.
  - On terminal delete we kill the tmux session.
  - On jupyter startup we sweep `cn-*` sessions that don't correspond to
    any persisted terminal slot to avoid long-term orphan accumulation.

If tmux is missing or any tmux call fails we transparently fall back to
the original (non-tmux) spawn so the feature can't take the terminal
down.
"""
from __future__ import annotations

import logging
import os
import shlex
import shutil
import subprocess
import threading
from typing import Any, Iterable

log = logging.getLogger(__name__)

SESSION_PREFIX = "cn-"


def _session_name(term_name: str) -> str:
    return f"{SESSION_PREFIX}{term_name}"


def tmux_available() -> bool:
    return shutil.which("tmux") is not None


def _clean_env() -> dict[str, str]:
    # Jupyter 가 tmux 안에서 돌고 있으면 TMUX/TMUX_PANE 가 자식에 상속돼
    # `sessions should be nested with care` 에러를 일으킨다. 명시적으로 제거.
    env = dict(os.environ)
    env.pop("TMUX", None)
    env.pop("TMUX_PANE", None)
    return env


def _run(args: list[str], cwd: str | None = None, timeout: float = 5.0) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        args, cwd=cwd, capture_output=True, timeout=timeout, check=False, env=_clean_env(),
    )


def _has_session(sess: str) -> bool:
    try:
        cp = _run(["tmux", "has-session", "-t", sess])
        return cp.returncode == 0
    except Exception as e:
        log.warning("tmux has-session failed for %s: %s", sess, e)
        return False


def _ensure_session(sess: str, cwd: str) -> bool:
    """Create detached tmux session if it doesn't already exist. Returns True
    iff the session is now usable (existed or was just created)."""
    if _has_session(sess):
        return True
    try:
        cp = _run(
            ["tmux", "new-session", "-d", "-s", sess, "-x", "200", "-y", "50"],
            cwd=cwd,
        )
        if cp.returncode != 0:
            log.warning("tmux new-session %s failed (rc=%s): %s",
                        sess, cp.returncode, cp.stderr.decode(errors="replace"))
            return False
    except Exception as e:
        log.warning("tmux new-session %s raised: %s", sess, e)
        return False
    # history-limit + status off — status bar 가 켜져 있으면 xterm scrollback 에
    # 매 redraw 마다 status 줄이 한 줄씩 누적돼서 스크롤백이 status 로 도배됨.
    for opt in (
        ["history-limit", "50000"],
        ["status", "off"],
    ):
        try:
            _run(["tmux", "set-option", "-t", sess, *opt])
        except Exception:
            pass
    return True


def kill_session(term_name: str) -> None:
    if not tmux_available():
        return
    sess = _session_name(term_name)
    try:
        _run(["tmux", "kill-session", "-t", sess])
    except Exception as e:
        log.debug("tmux kill-session %s failed: %s", sess, e)


def list_cn_sessions() -> list[str]:
    if not tmux_available():
        return []
    try:
        cp = _run(["tmux", "list-sessions", "-F", "#{session_name}"])
        if cp.returncode != 0:
            return []
        return [
            s for s in cp.stdout.decode(errors="replace").splitlines()
            if s.startswith(SESSION_PREFIX)
        ]
    except Exception:
        return []


def sweep_orphans(keep_names: Iterable[str]) -> int:
    """Kill cn-* tmux sessions whose suffix is not in keep_names."""
    keep = {_session_name(n) for n in keep_names}
    killed = 0
    for sess in list_cn_sessions():
        if sess in keep:
            continue
        try:
            _run(["tmux", "kill-session", "-t", sess])
            killed += 1
        except Exception:
            pass
    if killed:
        log.info("tmux orphan sweep: killed %d cn-* sessions", killed)
    return killed


def install(term_mgr, default_cwd: str) -> bool:
    """Monkey-patch term_mgr to spawn PTYs inside tmux sessions.

    Returns True if installed, False if tmux is missing (caller can keep
    running unchanged). Idempotent — patching twice is a no-op.
    """
    if not tmux_available():
        log.info("tmux not on PATH — keeping vanilla terminal spawn")
        return False
    if getattr(term_mgr, "_cn_tmux_installed", False):
        return True

    orig_new_named = term_mgr.new_named_terminal
    orig_terminate = term_mgr.terminate
    _lock = threading.Lock()

    def patched_new_named(**kwargs: Any):
        # Allocate name inside the lock so a concurrent caller can't grab the
        # same slot between _next_available_name() and the actual insertion.
        with _lock:
            name = kwargs.get("name") or term_mgr._next_available_name()
            kwargs["name"] = name
            sess = _session_name(name)
            cwd = kwargs.get("cwd") or default_cwd
            ok = _ensure_session(sess, cwd)
            if ok:
                # Jupyter server 자체가 tmux 안에서 돌고 있으면 TMUX 환경변수가
                # 자식 PTY 로 상속돼 "sessions should be nested with care" 로
                # attach 가 거부된다. sh -c 로 unset 후 exec.
                attach_cmd = f"unset TMUX TMUX_PANE; exec tmux attach -t {shlex.quote(sess)}"
                kwargs["shell_command"] = ["sh", "-c", attach_cmd]
            else:
                log.warning("falling back to vanilla shell for %s — tmux setup failed", name)
            try:
                return orig_new_named(**kwargs)
            except Exception:
                # If orig spawn fails after we created the tmux session,
                # nuke the session so a retry isn't blocked by a stale one.
                if ok:
                    try: _run(["tmux", "kill-session", "-t", sess])
                    except Exception: pass
                raise

    async def patched_terminate(name: str, force: bool = False):
        try:
            await orig_terminate(name, force=force)
        finally:
            kill_session(name)

    term_mgr.new_named_terminal = patched_new_named
    term_mgr.terminate = patched_terminate
    term_mgr._cn_tmux_installed = True
    log.info("tmux PTY wrapping enabled (session prefix %s)", SESSION_PREFIX)
    return True
