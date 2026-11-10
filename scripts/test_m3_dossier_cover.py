"""Regression checks: accept the real cover and reject incomplete submissions."""

import re
import unittest
from pathlib import Path
from urllib.parse import unquote

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

    def test_three_front_pages_are_separate_groups_with_the_right_images(self) -> None:
        groups = re.findall(
            r'<section class="m3-front-page ([^"]+)" style="([^"]+)">([\s\S]*?)</section>',
            self.text,
        )
        self.assertEqual([item[0] for item in groups], ["m3-cover", "m3-board-page", "m3-app-page"])
        for _, style, _ in groups:
            self.assertIn("break-after: page", style)
            self.assertIn("page-break-after: always", style)
        self.assertNotIn("![", groups[0][2])
        for group, expected in [
            (groups[1][2], ["planning-board.png", "submission-board.png"]),
            (groups[2][2], ["p0-movie-detail-browser.png", "login-error-browser.png"]),
        ]:
            images = re.findall(r'!\[[^\]]*\]\(images/ui/([^)]*)\)', group)
            self.assertEqual(images, expected)
        self.assertGreater(self.text.index("## 1. P0 Stories and status"), self.text.rfind("</section>"))

    def test_pdf_text_links_are_portable_github_urls(self) -> None:
        links = re.findall(r'(?<!!)\[[^\]]*\]\(([^)]+)\)', self.text)
        self.assertTrue(links)
        prefix = "https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE/blob/main/"
        for target in links:
            with self.subTest(target=target):
                self.assertTrue(target.startswith("https://github.com/"))
                self.assertNotIn("C:/", target)
                self.assertNotIn("file:", target)
                if target.startswith(prefix):
                    relative = unquote(target[len(prefix):].split("#")[0])
                    self.assertTrue((ROOT / relative).is_file())

    def test_current_publication_status_does_not_claim_a_fabricated_receipt(self) -> None:
        self.assertNotIn("is open.", self.text.split("### Contract and wrap-up handoffs", 1)[1])
        self.assertIn("PO stated in chat", self.text)
        self.assertIn("have not been supplied", self.text)
        self.assertIn("**before merge**", self.text)
        self.assertNotIn("To do: from a clean checkout", self.text)


if __name__ == "__main__":
    unittest.main()
