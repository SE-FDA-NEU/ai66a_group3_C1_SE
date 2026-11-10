"""Fingerprint S4-T12 source from a commit, independent of a dirty checkout."""

from __future__ import annotations

import argparse
import hashlib
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_COMMIT = "d3c24acec0e1e0d67c4004328e7cf096775f8f6f"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def paths_from(output: bytes) -> set[Path]:
    return {Path(os.fsdecode(name)) for name in output.split(b"\0") if name}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default=BASE_COMMIT, help="base commit for the source file list")
    parser.add_argument("--head", default="HEAD", help="tested commit; defaults to HEAD")
    parser.add_argument("--worktree", action="store_true", help="also hash uncommitted source files")
    args = parser.parse_args()

    base = git("rev-parse", "--verify", f"{args.base}^{{commit}}").decode().strip()
    head = git("rev-parse", "--verify", f"{args.head}^{{commit}}").decode().strip()
    if args.worktree:
        changed = git("diff", "--name-only", "--diff-filter=ACMR", "-z", base,
                      "--", "backend/", "frontend/")
        untracked = git("ls-files", "--others", "--exclude-standard", "-z", "--",
                        "backend/", "frontend/")
        paths = sorted(paths_from(changed) | paths_from(untracked))
    else:
        changed = git("diff", "--name-only", "--diff-filter=ACMR", "-z", base, head,
                      "--", "backend/", "frontend/")
        paths = sorted(paths_from(changed))

    digest = hashlib.sha256()
    for relative in paths:
        content = ((ROOT / relative).read_bytes() if args.worktree else
                   git("show", f"{head}:{relative.as_posix()}"))
        digest.update(relative.as_posix().encode() + b"\0")
        digest.update(hashlib.sha256(content).digest())
    scope = "worktree" if args.worktree else "commit"
    print(f"base={base} head={head} scope={scope} files={len(paths)} sha256={digest.hexdigest()}")


if __name__ == "__main__":
    main()
