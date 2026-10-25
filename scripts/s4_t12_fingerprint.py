"""Print a reproducible SHA-256 of changed backend/frontend source files."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
paths = sorted(
    Path(name)
    for name in subprocess.check_output(
        ["git", "ls-files", "--modified", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
    ).decode().split("\0")
    if name.startswith(("backend/", "frontend/"))
)
digest = hashlib.sha256()
for relative in paths:
    digest.update(relative.as_posix().encode() + b"\0")
    digest.update(hashlib.sha256((ROOT / relative).read_bytes()).digest())
print(f"files={len(paths)} sha256={digest.hexdigest()}")
