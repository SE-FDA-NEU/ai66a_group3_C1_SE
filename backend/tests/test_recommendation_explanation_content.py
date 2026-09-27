import re
from pathlib import Path

CONTENT_PATH = (
    Path(__file__).resolve().parents[2] / "docs" / "recommendation-explanation.md"
)


def _section(content: str, heading: str, next_heading: str) -> str:
    return content.split(heading, 1)[1].split(next_heading, 1)[0]


def test_recommendation_explanation_has_exactly_three_process_steps():
    content = CONTENT_PATH.read_text(encoding="utf-8")
    process = _section(
        content,
        "## How recommendations work\n",
        "## Browse without an account\n",
    )

    steps = re.findall(r"^\d+\. \*\*(.+?)\*\*", process, flags=re.MULTILINE)

    assert steps == [
        "Register or sign in.",
        "Choose genres.",
        "Receive recommendations with optional movie ratings.",
    ]


def test_recommendation_explanation_keeps_required_public_statements_outside_steps():
    content = CONTENT_PATH.read_text(encoding="utf-8")
    process = _section(
        content,
        "## How recommendations work\n",
        "## Browse without an account\n",
    )

    assert (
        "You can browse popular movies without signing in or providing preferences."
        in content
    )
    assert "This product uses the TMDB API but is not endorsed or certified by TMDB." in content
    assert "You can browse popular movies without signing in or providing preferences." not in process
    assert "This product uses the TMDB API but is not endorsed or certified by TMDB." not in process


def test_recommendation_explanation_does_not_mislabel_future_text_similarity():
    content = CONTENT_PATH.read_text(encoding="utf-8")

    assert "not as a trained model, an LLM, or a machine-learning model" in content
    assert "before Spike #43 has produced and reviewed an accepted result" in content
