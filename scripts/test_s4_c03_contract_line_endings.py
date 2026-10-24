"""Exercise the C03 verifier on independent LF and CRLF text exports."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

SOURCE = Path(__file__).resolve().parents[1]
TEXT_FILES = (
    "docs/api.md",
    "docs/architecture.md",
    "docs/design.md",
    "docs/requirements.md",
    "docs/testing.md",
    "docs/evidence/s4-c03-local-contract-check.md",
    "docs/evidence/s4-c03-acceptance-matrix.md",
    "scripts/verify_s4_c03_contract.py",
    "scripts/test_s4_c03_contract_line_endings.py",
)
HASH_FILES = (
    "docs/api.md",
    "docs/architecture.md",
    "docs/design.md",
    "docs/requirements.md",
    "docs/testing.md",
    "scripts/verify_s4_c03_contract.py",
    "scripts/test_s4_c03_contract_line_endings.py",
)
LINK = re.compile(r"\]\(([^)]+)\)")


def write_export(destination: Path, newline: str) -> None:
    for relative in TEXT_FILES:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        content = (SOURCE / relative).read_bytes().decode("utf-8")
        normalized = content.replace("\r\n", "\n").replace("\r", "\n")
        target.write_bytes(normalized.replace("\n", newline).encode("utf-8"))

    # The verifier checks that local link targets exist. Their contents do not
    # enter the contract digest, so placeholders keep these exports small.
    for relative in TEXT_FILES:
        document = destination / relative
        if document.suffix != ".md":
            continue
        for target in LINK.findall(document.read_text(encoding="utf-8")):
            if target.startswith(("http:", "https:", "#", "mailto:")):
                continue
            local = target.split("#", 1)[0]
            if not local:
                continue
            path = (document.parent / local).resolve()
            if not path.is_relative_to(destination.resolve()):
                raise AssertionError(f"link escapes export: {local}")
            if path.exists():
                continue
            source_target = (SOURCE / relative).parent / local
            if source_target.is_dir() or local.endswith("/"):
                path.mkdir(parents=True, exist_ok=True)
            elif source_target.is_file():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()
            else:
                raise AssertionError(f"source link is missing: {relative}: {local}")


def run_export(newline: str, name: str) -> list[str]:
    with TemporaryDirectory(prefix=f"s4-c03-{name.lower()}-") as temporary:
        destination = Path(temporary).resolve()
        write_export(destination, newline)
        result = subprocess.run(
            [sys.executable, str(destination / "scripts/verify_s4_c03_contract.py")],
            cwd=destination,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
        if result.returncode != 0:
            raise AssertionError(f"{name} export failed:\n{result.stdout}{result.stderr}")
        if "S4-C03 local document structure: PASS" not in result.stdout:
            raise AssertionError(f"{name} export did not report PASS")
        hashes = [line for line in result.stdout.splitlines() if line.startswith("sha256-lf ")]
        paths = [line.split(" ", 2)[1] for line in hashes]
        if paths != list(HASH_FILES):
            raise AssertionError(f"{name} export printed unexpected hash paths: {paths}")
        print(f"{name} export: PASS ({len(hashes)} normalized hashes)")
        return hashes


def main() -> None:
    lf_hashes = run_export("\n", "LF")
    crlf_hashes = run_export("\r\n", "CRLF")
    if lf_hashes != crlf_hashes:
        raise AssertionError("LF and CRLF exports produced different contract hashes")
    print("LF/CRLF normalized hashes identical: PASS")


if __name__ == "__main__":
    main()
