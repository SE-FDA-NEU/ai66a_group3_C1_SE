"""Export successful Playwright S04 results as reviewable, credential-free files."""

from __future__ import annotations

import argparse
import base64
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def collect(report_path: Path, output: Path) -> None:
    report = json.loads(report_path.read_text(encoding="utf-8"))
    stats = report["stats"]
    if (
        report["errors"]
        or stats["unexpected"]
        or stats["flaky"]
        or stats["skipped"]
        or stats["expected"] != 7
    ):
        raise ValueError(
            "Evidence requires all seven S04 tests passing without retries"
        )
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for suite in report["suites"]:
        for index, spec in enumerate(suite.get("specs", []), start=1):
            test = spec["tests"][0]
            if len(test["results"]) != 1 or test["results"][0]["status"] != "passed":
                raise ValueError(f"Not a single clean pass: {spec['title']}")
            result = test["results"][0]
            attachments = []
            for attachment in result["attachments"]:
                name = f"{index:02d}-{Path(attachment['name']).name}"
                destination = output / name
                if "body" in attachment:
                    destination.write_bytes(base64.b64decode(attachment["body"]))
                else:
                    shutil.copyfile(attachment["path"], destination)
                attachments.append(name)
            results.append(
                {
                    "test": spec["title"],
                    "status": result["status"],
                    "durationMs": result["duration"],
                    "evidence": attachments,
                }
            )
    summary = {
        "stats": stats,
        "testedSource": report["config"]["metadata"],
        "results": results,
    }
    (output / "results.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"PASS: exported {len(results)} browser/API cases to {output.relative_to(ROOT)}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--report", type=Path, default=ROOT / "frontend/test-results/s04-results.json"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "docs/evidence/s3-t14-cold-start-acceptance",
    )
    args = parser.parse_args()
    collect(args.report.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
