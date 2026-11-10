"""Validate M3's Markdown cover fields independently of table/bullet layout."""

import re


def validate_cover(text: str) -> None:
    """Require the actual current cover, not stale table-format fragments."""
    cover = text.split("<!-- pdf:page -->", 1)[0]
    fields = {
        "Team": "Team 03 — AI Movie Recommendation System",
        "Topic": "AI Movie Recommendation System",
        "Product Owner": "`@kietxuan`",
        "Scrum Master": "`@vu-huzy` (Sprint 3)",
        "Submitted by": "Nguyen Xuan Kiet",
    }
    for name, expected in fields.items():
        match = re.search(rf"^\*\*{re.escape(name)}:\*\*\s*(.+)$", cover, re.MULTILINE)
        assert match and match[1].strip() == expected, f"Missing/incorrect cover field: {name}"
    members = [
        ("Nguyen Xuan Kiet", "11247306"),
        ("Tran Minh Hoang", "11247292"),
        ("Tran Tuan Anh", "11247264"),
        ("Vu Quoc Huy", "11247301"),
        ("Nguyen Tuan Anh", "11247260"),
    ]
    for name, student_id in members:
        assert f"- {name} ({student_id})" in cover, f"Missing/incorrect member: {name}"
    repo = "https://github.com/SE-FDA-NEU/ai66a_group3_C1_SE"
    for field, url in {
        "Repository": repo,
        "Project board": "https://github.com/orgs/SE-FDA-NEU/projects/9",
        "Setup guide": repo + "/blob/main/docs/SETUP.md",
    }.items():
        assert re.search(
            rf"^\*\*{re.escape(field)}:\*\* \[[^\]]+\]\({re.escape(url)}\)$",
            cover,
            re.MULTILINE,
        ), f"Missing/incorrect cover link: {field}"
