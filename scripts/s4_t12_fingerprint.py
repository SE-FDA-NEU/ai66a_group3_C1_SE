"""Fingerprint backend/frontend files changed since the S4-T12 base commit."""

from __future__ import annotations

import hashlib
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_COMMIT = "d3c24acec0e1e0d67c4004328e7cf096775f8f6f"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


changed = git(
    "diff", "--name-only", "--diff-filter=ACMR", "-z", BASE_COMMIT,
    "--", "backend/", "frontend/",
)
untracked = git(
    "ls-files", "--others", "--exclude-standard", "-z", "--",
    "backend/", "frontend/",
)
paths = sorted({
    Path(os.fsdecode(name))
    for name in (changed + untracked).split(b"\0")
    if name
})
digest = hashlib.sha256()
for relative in paths:
    digest.update(relative.as_posix().encode() + b"\0")
    digest.update(hashlib.sha256((ROOT / relative).read_bytes()).digest())
head = git("rev-parse", "HEAD").decode().strip()
print(f"base={BASE_COMMIT} head={head} files={len(paths)} sha256={digest.hexdigest()}")
