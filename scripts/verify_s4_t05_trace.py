"""Map every Section 2 ID to a node selected by the default M4 pytest command."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/s4-t05-acceptance.md"
START = "<!-- TC-MAP-START -->"
END = "<!-- TC-MAP-END -->"


def main() -> int:
    contract = (ROOT / "docs/testing.md").read_text(encoding="utf-8")
    ids = re.findall(r"^\| (TC-P0-S\d{2}-\d{3}) \|", contract, re.MULTILINE)
    if not ids:
        raise RuntimeError("Section 2 has no P0 case IDs")
    if len(ids) != len(set(ids)):
        raise RuntimeError("Section 2 has duplicate IDs")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    nodes = [line for line in result.stdout.splitlines() if line.startswith("tests/")]
    rows = ["| Section 2 ID | Collected pytest node |", "|---|---|"]
    for case_id in ids:
        parameter = [node for node in nodes if node.endswith(f"[{case_id}]")]
        plain = [node for node in nodes if case_id.replace("-", "_") in node]
        matches = parameter or plain
        if not matches:
            raise RuntimeError(f"No default M4 pytest node for {case_id}")
        rows.append(
            f"| `{case_id}` | " + "<br>".join(f"`{node}`" for node in matches) + " |"
        )
    table = "\n".join(rows)
    if "--write" in sys.argv:
        body = EVIDENCE.read_text(encoding="utf-8")
        if body.count(START) != 1 or body.count(END) != 1:
            raise RuntimeError("Evidence file needs one pair of TC map markers")
        before, rest = body.split(START, 1)
        _, after = rest.split(END, 1)
        EVIDENCE.write_text(
            before + START + "\n" + table + "\n" + END + after, encoding="utf-8"
        )
    else:
        print(table)
    print(
        f"Mapped {len(ids)} unique Section 2 IDs to {len(nodes)} default M4 nodes",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
