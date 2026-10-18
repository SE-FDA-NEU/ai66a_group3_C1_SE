"""Read-only consistency tests; never substitutes for the PO's acceptance."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class CloseoutConsistencyTests(unittest.TestCase):
    def test_points_exclude_previously_delivered_registration(self) -> None:
        ledger = (ROOT / "docs/evidence/s3-c02-reconciliation.md").read_text(encoding="utf-8")
        rows = re.findall(
            r"^\| S\w+ #(\d+) \| (\d+) \| (\d+) \| \*?\*?(\d+)\*?\*? \|",
            ledger,
            re.MULTILINE,
        )
        points = {int(issue): tuple(map(int, values)) for issue, *values in rows}
        self.assertEqual(set(points), {17, 18, 19, 20, 21, 23, 31, 44, 45})
        self.assertEqual(points[44], (3, 3, 0))
        self.assertEqual(sum(row[1] for row in points.values()), 24)
        self.assertEqual(sum(row[2] for row in points.values()), 30)
        self.assertEqual(sum(points[n][2] for n in (21, 23, 31)), 9)

    def test_ui_keeps_four_sections_and_records_po_accepted_statuses(self) -> None:
        ui = (ROOT / "docs/ui.md").read_text(encoding="utf-8")
        self.assertEqual(len(re.findall(r"^## \d\. ", ui, re.MULTILINE)), 4)
        for story in ("S01", "S02", "S03", "S04", "S12", "S13", "S06", "S09"):
            row = next(line for line in ui.splitlines() if line.startswith(f"| {story} "))
            self.assertIn("| [works](", row)
        self.assertIn("PO accepted", ui.replace("PO\naccepted", "PO accepted"))

    def test_log_records_all_three_figures_and_preserves_remaining_obligations(self) -> None:
        log = (ROOT / "docs/sprint-log.md").read_text(encoding="utf-8")
        sprint = log.split("## Sprint 3 -", 1)[1]
        for marker in (
            "**Committed Story Points: 24.**",
            "**Completed Story Points: 30**",
            "**Velocity:** 30 Story Points.",
            "**Closure rule:** do not close #133",
        ):
            self.assertIn(marker, sprint)
        self.assertNotIn("Definition-of-Done item", sprint)

    def test_changed_closeout_documents_have_no_missing_local_link_files(self) -> None:
        for name in (
            "docs/evidence/s3-c02-reconciliation.md",
            "docs/sprint-log.md",
            "docs/ui.md",
            "docs/evidence/s3-m3-p0-handoff/README.md",
            "docs/evidence/s3-m3-p0-handoff/human-validation.md",
        ):
            doc = ROOT / name
            for target in re.findall(r"\]\(([^)]+)\)", doc.read_text(encoding="utf-8")):
                target = target.removeprefix("<").removesuffix(">")
                if target.startswith(("https://", "http://", "#")):
                    continue
                with self.subTest(document=name, target=target):
                    self.assertTrue((doc.parent / target.split("#")[0]).exists())


if __name__ == "__main__":
    unittest.main()
