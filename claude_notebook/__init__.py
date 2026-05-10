"""claude-notebook — single-user web workspace for claude code.

Multi-host SSH, drag-drop file attach, lost-update protection, host-aware
file tree/read/write. See README.md for full feature list.

This module is a thin shim over `jupyter_ext` (kept for backward compat with
existing `PYTHONPATH=. + jupyter_ext` deployments). New users import this.
"""

# Re-export everything from jupyter_ext so Jupyter's extension loader finds
# the same entry points under either name.
from jupyter_ext import *  # noqa: F401,F403
from jupyter_ext import (  # noqa: F401
    _jupyter_server_extension_paths,
    load_jupyter_server_extension,
)

__version__ = "0.1.0"
