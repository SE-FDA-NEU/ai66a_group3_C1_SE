"""Regression checks: accept the real cover and reject incomplete submissions."""

import unittest
from pathlib import Path

from m3_dossier_cover import validate_cover

ROOT = Path(__file__).resolve().parents[1]


class CoverValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.text = (ROOT / "docs/ui.md").read_text(encoding="utf-8")

    def test_current_cover_passes(self) -> None:
        validate_cover(self.text)

    def test_missing_or_incorrect_required_field_fails(self) -> None:
        for original in [
            "**Team:** Team 03 — AI Movie Recommendation System",
            "**Topic:** AI Movie Recommendation System",
            "**Product Owner:** `@kietxuan`",
            "**Scrum Master:** `@vu-huzy` (Sprint 3)",
            "**Submitted by:** Nguyen Xuan Kiet",
        ]:
            with self.subTest(field=original), self.assertRaises(AssertionError):
                validate_cover(self.text.replace(original, original + " WRONG", 1))

    def test_each_name_id_pair_is_required(self) -> None:
        for student_id in ["11247306", "11247292", "11247264", "11247301", "11247260"]:
            with self.subTest(student_id=student_id), self.assertRaises(AssertionError):
                validate_cover(self.text.replace(student_id, "00000000", 1))

    def test_all_three_cover_links_are_required(self) -> None:
        for label in ["Repository", "Project board", "Setup guide"]:
            with self.subTest(label=label), self.assertRaises(AssertionError):
                validate_cover(self.text.replace(f"**{label}:**", "Missing link:", 1))

    def test_body_fields_cannot_replace_missing_cover(self) -> None:
        cover, body = self.text.split("<!-- pdf:page -->", 1)
        with self.assertRaises(AssertionError):
            validate_cover("<!-- pdf:page -->" + body + cover)


if __name__ == "__main__":
    unittest.main()
