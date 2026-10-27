"""Verify S4-T04 ranking score UI in Chromium, FastAPI and temporary SQLite.

A synthetic two-candidate catalogue (raw popularity 80/80) is migrated into a
temporary database; nothing reads the development database or a provider token.
The 80/81/79 numbers belong to this deterministic fixture, not to the imported
TMDb catalogue. Ports 8000 and 5173 must be free.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
from contextlib import closing, contextmanager
from datetime import datetime
from pathlib import Path

import httpx
from verify_s02_recommendations_ui import (
    browser_websocket,
    require_free_port,
    seed_catalogue,
)
from verify_s09_popular_ui import (
    BACKEND_URL,
    FRONTEND_URL,
    PROJECT_ROOT,
    command_version,
    find_browser,
    git_output,
    node_command,
    remove_temporary_database,
    run_migrations,
    running_process,
    sqlite_url,
    wait_for_url,
)
from verify_s13_rating_ui import (
    PASSWORD,
    RatingBrowser,
    database_snapshot,
    login_in_browser,
    prepare_account,
    sign_out_to_login,
)

ACTION, COMEDY = 28, 35
ZULU = "40000000-0000-0000-0000-000000000001"
ALPHA = "40000000-0000-0000-0000-000000000002"
SILENT = "40000000-0000-0000-0000-000000000003"
FIXTURE = {
    "catalogueRevision": "fixture-revision-s4-t04",
    "genres": [{"id": ACTION, "name": "Action"}, {"id": COMEDY, "name": "Comedy"}],
    "candidateRows": [
        {
            "id": ZULU,
            "title": "Zulu Action",
            "releaseYear": 2040,
            "genreIds": [ACTION],
            "popularityScore": 80.0,
        },
        {
            "id": ALPHA,
            "title": "Alpha Comedy",
            "releaseYear": 2041,
            "genreIds": [COMEDY],
            "popularityScore": 80.0,
        },
        # No popularity: the score must read "Information unavailable", never 0.
        {
            "id": SILENT,
            "title": "Silent Comedy",
            "releaseYear": 2042,
            "genreIds": [COMEDY],
            "popularityScore": None,
        },
    ],
}
EMAIL_A = "t04-account-a@example.test"
EMAIL_B = "t04-account-b@example.test"
LIST = "/recommendations?source=t04#results"
RAISED = "Your high ratings of related movies raised this score."
LOWERED = "Your low ratings of related movies lowered this score."
UNCHANGED = "Your ratings have not changed this score."
UNAVAILABLE = "Your rating signals are temporarily unavailable, so this score uses popularity only."
VIEWPORTS = [("375", 375, 812), ("768", 768, 1024), ("1440", 1440, 1000)]

CARDS_JS = """(() => [...document.querySelectorAll('article.movie-card')].map(card => {
  const value = (label) => {
    const term = [...card.querySelectorAll('dt')].find(n => n.textContent.trim() === label);
    return term ? term.nextElementSibling.textContent.trim() : null;
  };
  return {
    title: card.querySelector('h2').textContent.trim(),
    popularity: value('TMDb popularity'),
    ranking: value('Ranking score for you'),
    reason: card.querySelector('.movie-ranking-reason')?.textContent.trim() || null,
    own: /Your saved rating|Not rated yet|\\d\\/5/.test(card.innerText),
  };
}))()"""

LAYOUT_JS = """(() => {
  const parse = (c) => c.match(/[\\d.]+/g).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const body = parse(getComputedStyle(document.body).backgroundColor);
  const contrast = (node, card) => {
    const fg = parse(getComputedStyle(node).color);
    const raw = parse(getComputedStyle(card).backgroundColor);
    const a = raw.length > 3 ? raw[3] : 1;
    const bg = [0, 1, 2].map(i => raw[i] * a + body[i] * (1 - a));
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const cards = [...document.querySelectorAll('article.movie-card')];
  const rows = cards.flatMap(card => [...card.querySelectorAll(
    '.movie-ranking dt, .movie-ranking dd, .movie-ranking-reason')].map(node => {
    const box = node.getBoundingClientRect(), outer = card.getBoundingClientRect();
    return { text: node.textContent.trim(), contrast: contrast(node, card),
      inside: box.left >= outer.left - 1 && box.right <= outer.right + 1,
      clipped: node.scrollWidth > node.clientWidth + 1 };
  }));
  return { theme: document.documentElement.dataset.theme, width: innerWidth,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1, rows };
})()"""


@contextmanager
def server_process(command, *, environment, output_path):
    """Run a server and, on Windows, end its whole process tree.

    terminate() only ends the launcher there and would leave the real server
    holding ports 8000/5173 for the next run.
    """
    with running_process(
        command, environment=environment, output_path=output_path
    ) as process:
        try:
            yield process
        finally:
            if sys.platform == "win32" and process.poll() is None:
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    capture_output=True,
                    check=False,
                )


class T04Browser(RatingBrowser):
    def cards(self) -> list[dict]:
        return self.evaluate(CARDS_JS)

    def layout(self) -> dict:
        return self.evaluate(LAYOUT_JS)

    def viewport(self, width: int, height: int) -> None:
        self.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
        )
        time.sleep(0.4)

    def clear_viewport(self) -> None:
        self.call("Emulation.clearDeviceMetricsOverride")
        time.sleep(0.2)

    def shoot_list(self, output: Path) -> None:
        """Capture the whole recommendations card, beyond the visible viewport."""
        rect = self.evaluate(
            """(() => { const r = document.querySelector('.recommendations-card')
              .getBoundingClientRect();
              return { x: r.left + scrollX, y: r.top + scrollY, width: r.width,
                height: r.height }; })()"""
        )
        shot = self.call(
            "Page.captureScreenshot",
            {
                "format": "png",
                "captureBeyondViewport": True,
                "clip": {**rect, "scale": 1},
            },
        )
        output.write_bytes(base64.b64decode(shot["data"]))

    def press(self, key: str, code: str, key_code: int) -> None:
        for kind in ("keyDown", "keyUp"):
            self.call(
                "Input.dispatchKeyEvent",
                {
                    "type": kind,
                    "key": key,
                    "code": code,
                    "windowsVirtualKeyCode": key_code,
                },
            )

    def theme(self, name: str) -> None:
        if self.evaluate("document.documentElement.dataset.theme") != name:
            other = "light" if name == "dark" else "dark"
            self.click_aria(f"Switch to {name} theme")
            self.wait_for(
                lambda _s: (
                    self.evaluate("document.documentElement.dataset.theme") == name
                ),
                f"{other}->{name} theme",
            )


def wait_list(page: T04Browser, label: str, *, order: list[str]) -> list[dict]:
    page.wait_for(
        lambda state: state["path"] == "/recommendations" and state["cards"] == order,
        label,
    )
    return page.cards()


def rate_from_list(
    page: T04Browser, value: int, database_path: Path, user_id: str
) -> None:
    page.click_href(f"/movies/{ZULU}")
    page.wait_for(
        lambda s: (
            s["path"] == f"/movies/{ZULU}"
            and any(f["type"] == "radio" for f in s["fields"])
        ),
        "detail rating form",
    )
    page.select_rating(value)
    page.click_text("button", "Save rating")
    page.wait_for(
        lambda s: f"Your saved rating: {value}/5" in s["mainText"], f"saved {value}"
    )
    with closing(sqlite3.connect(database_path)) as connection:
        rows = connection.execute(
            "SELECT rating FROM user_movie_ratings WHERE user_id = ? AND movie_id = ?",
            (user_id, ZULU),
        ).fetchall()
    assert rows == [(value,)], rows


def back_to_list(page: T04Browser) -> None:
    # The label carries an arrow, so find the link by the exact list URL it must restore.
    page.wait_for(
        lambda s: any(link["href"] == LIST for link in s["links"]), "detail back link"
    )
    page.click_href(LIST)
    state = page.wait_for(
        lambda s: s["path"] == "/recommendations" and bool(s["cards"]),
        "back on recommendations",
    )
    # The merged review finding: a rating save must not drop page/query/hash context.
    assert (state["search"], state["hash"]) == ("?source=t04", "#results"), state


def main() -> int:
    args = parse_args()
    source_status = git_output("status", "--short")
    evidence = args.evidence_dir.resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    browser_path = find_browser(args.browser)
    require_free_port(8000)
    require_free_port(5173)
    checks: dict[str, str] = {}
    api_evidence: dict[str, object] = {}
    layouts: list[dict] = []
    browser_product = "unavailable"

    with tempfile.TemporaryDirectory(
        prefix="s4-t04-", ignore_cleanup_errors=True
    ) as tmp:
        tmp_path = Path(tmp)
        database_path = tmp_path / "acceptance.db"
        environment = os.environ | {
            "DATABASE_URL": sqlite_url(database_path),
            "TMDB_READ_ACCESS_TOKEN": "",
        }
        run_migrations(environment["DATABASE_URL"], environment)
        seed_catalogue(database_path, FIXTURE)
        backend = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--app-dir",
            "backend",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ]
        frontend = [
            node_command(),
            str(PROJECT_ROOT / "frontend/node_modules/vite/bin/vite.js"),
            str(PROJECT_ROOT / "frontend"),
            "--host",
            "127.0.0.1",
            "--port",
            "5173",
            "--strictPort",
        ]
        profile = tmp_path / "browser-profile"
        browser = [
            str(browser_path),
            "--headless=new",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--remote-allow-origins=*",
            "--remote-debugging-port=0",
            "--window-size=1440,1000",
            f"--user-data-dir={profile}",
            "about:blank",
        ]
        with (
            server_process(
                backend, environment=environment, output_path=tmp_path / "be.txt"
            ) as be,
            server_process(
                frontend, environment=environment, output_path=tmp_path / "fe.txt"
            ) as fe,
            server_process(
                browser, environment=environment, output_path=tmp_path / "br.txt"
            ) as br,
            httpx.Client(base_url=BACKEND_URL, timeout=10) as api_a,
            httpx.Client(base_url=BACKEND_URL, timeout=10) as api_b,
        ):
            wait_for_url(f"{BACKEND_URL}/health", be, tmp_path / "be.txt")
            wait_for_url(FRONTEND_URL, fe, tmp_path / "fe.txt")
            user_a = prepare_account(api_a, email=EMAIL_A, genre_ids=[ACTION, COMEDY])
            # B only registers: no saved genres, so it must see Popular / Not personalised.
            assert (
                api_b.post(
                    "/api/auth/register", json={"email": EMAIL_B, "password": PASSWORD}
                ).status_code
                == 201
            )

            def api_ranking(label: str) -> list[dict]:
                body = api_a.get("/api/me/recommendations?limit=10")
                assert body.status_code == 200, body.text
                payload = body.json()
                api_evidence[label] = {
                    "account": EMAIL_A,
                    "catalogueRevision": payload["meta"]["catalogueRevision"],
                    "movies": payload["data"]["movies"],
                }
                return payload["data"]["movies"]

            page = T04Browser(browser_websocket(profile, br))
            try:
                browser_product = page.call("Browser.getVersion")["product"]
                page.navigate_to("/login")
                page.wait_for(
                    lambda s: (
                        s["path"] == "/login"
                        and any(f["id"] == "email" for f in s["fields"])
                    ),
                    "login form",
                )
                login_in_browser(page, EMAIL_A)
                page.spa_navigate(LIST)

                # 1. No ratings: baseline, 80/80 with the title tie-break, null score honest.
                cards = wait_list(
                    page,
                    "baseline list",
                    order=["Alpha Comedy", "Zulu Action", "Silent Comedy"],
                )
                by = {c["title"]: c for c in cards}
                assert (
                    by["Alpha Comedy"]["popularity"],
                    by["Alpha Comedy"]["ranking"],
                ) == ("80", "80")
                assert (
                    by["Zulu Action"]["popularity"],
                    by["Zulu Action"]["ranking"],
                ) == ("80", "80")
                assert (
                    by["Alpha Comedy"]["reason"]
                    == by["Zulu Action"]["reason"]
                    == UNCHANGED
                )
                assert (
                    by["Silent Comedy"]["popularity"],
                    by["Silent Comedy"]["ranking"],
                ) == ("Information unavailable", "Information unavailable")
                assert by["Silent Comedy"]["reason"] is None
                assert not any(c["own"] for c in cards)
                baseline = api_ranking("1-baseline")
                assert [m["basis"] for m in baseline] == ["baseline"] * 3
                page.shoot_list(
                    evidence / "t04-01-personalised-baseline-and-missing-score.png"
                )
                checks["baseline_and_missing_score"] = "PASS"

                # 2. Rating 5 on the Action movie: 81 above Comedy 80, raw popularity stays 80.
                rate_from_list(page, 5, database_path, user_a)
                back_to_list(page)
                cards = wait_list(
                    page,
                    "raised list",
                    order=["Zulu Action", "Alpha Comedy", "Silent Comedy"],
                )
                by = {c["title"]: c for c in cards}
                assert (
                    by["Zulu Action"]["popularity"],
                    by["Zulu Action"]["ranking"],
                ) == ("80", "81")
                assert by["Zulu Action"]["reason"] == RAISED
                assert (
                    by["Alpha Comedy"]["popularity"],
                    by["Alpha Comedy"]["ranking"],
                ) == ("80", "80")
                assert by["Alpha Comedy"]["reason"] == UNCHANGED
                assert not any(c["own"] for c in cards), (
                    "a rating must not be copied onto cards"
                )
                raised = api_ranking("2-rated-5")
                assert [
                    (m["title"], m["popularityScore"], m["adjustedScore"])
                    for m in raised[:2]
                ] == [("Zulu Action", 80, 81), ("Alpha Comedy", 80, 80)]
                page.shoot_list(evidence / "t04-02-personalised-rating-5-raised.png")
                checks["rating_5_81_over_80_with_context_kept"] = "PASS"

                # 3. Theme and viewport matrix on the raised state.
                for theme in ("dark", "light"):
                    page.theme(theme)
                    for name, width, height in VIEWPORTS:
                        page.viewport(width, height)
                        layout = page.layout()
                        assert not layout["overflowX"], layout
                        assert layout["rows"], layout
                        for row in layout["rows"]:
                            assert row["inside"] and not row["clipped"], (
                                name,
                                theme,
                                row,
                            )
                            assert row["contrast"] >= 4.5, (name, theme, row)
                        layouts.append(
                            {
                                "theme": theme,
                                "viewport": name,
                                "minContrast": round(
                                    min(r["contrast"] for r in layout["rows"]), 2
                                ),
                            }
                        )
                        page.shoot_list(evidence / f"t04-03-{theme}-{name}px.png")
                    page.clear_viewport()
                page.theme("dark")
                checks["themes_and_375_768_1440_layout_contrast"] = "PASS"

                # 4. Keyboard: Tab reaches a card's detail link with a visible focus ring.
                page.viewport(1440, 1000)
                focused = None
                for _ in range(60):
                    page.press("Tab", "Tab", 9)
                    focused = page.evaluate(
                        """(() => { const n = document.activeElement; const s = getComputedStyle(n);
                          return { label: n.getAttribute('aria-label') || n.textContent.trim(),
                            outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth,
                            visible: n.matches(':focus-visible') }; })()"""
                    )
                    if focused["label"] == "View details for Zulu Action":
                        break
                assert focused and focused["label"] == "View details for Zulu Action", (
                    focused
                )
                assert focused["visible"] and focused["outlineStyle"] != "none", focused
                assert float(focused["outlineWidth"].removesuffix("px")) >= 2, focused
                page.shoot_list(evidence / "t04-04-keyboard-focus-on-card.png")
                page.press("Enter", "Enter", 13)
                page.wait_for(
                    lambda s: s["path"] == f"/movies/{ZULU}", "Enter opens detail"
                )
                back_to_list(page)
                page.clear_viewport()
                checks["keyboard_focus_visible_and_enter_opens_detail"] = "PASS"

                # 5. Rating 1 replaces the signal: 79 below Comedy 80, still one stored row.
                rate_from_list(page, 1, database_path, user_a)
                back_to_list(page)
                cards = wait_list(
                    page,
                    "lowered list",
                    order=["Alpha Comedy", "Zulu Action", "Silent Comedy"],
                )
                by = {c["title"]: c for c in cards}
                assert (
                    by["Zulu Action"]["popularity"],
                    by["Zulu Action"]["ranking"],
                ) == ("80", "79")
                assert by["Zulu Action"]["reason"] == LOWERED
                assert by["Alpha Comedy"]["ranking"] == "80"
                lowered = api_ranking("3-rated-1")
                assert [
                    (m["title"], m["popularityScore"], m["adjustedScore"])
                    for m in lowered[:2]
                ] == [("Alpha Comedy", 80, 80), ("Zulu Action", 80, 79)]
                page.shoot_list(evidence / "t04-05-personalised-rating-1-lowered.png")
                checks["rating_1_79_below_80"] = "PASS"

                # 6. A real rating-read failure: the ratings table is unreadable for a moment.
                with closing(sqlite3.connect(database_path)) as connection, connection:
                    connection.execute(
                        "ALTER TABLE user_movie_ratings RENAME TO ratings_held"
                    )
                try:
                    page.spa_navigate("/preferences")
                    page.spa_navigate(LIST)
                    page.wait_for(
                        lambda s: s["path"] == "/recommendations" and bool(s["cards"]),
                        "degraded list",
                    )
                    cards = page.cards()
                    assert cards, "degraded response must still list movies"
                    scored = [
                        c for c in cards if c["popularity"] != "Information unavailable"
                    ]
                    assert scored and all(c["reason"] == UNAVAILABLE for c in scored), (
                        cards
                    )
                    assert all(c["ranking"] == c["popularity"] for c in scored), cards
                    assert not any(
                        "no ratings" in (c["reason"] or "").lower() for c in cards
                    )
                    degraded = api_ranking("4-rating-read-unavailable")
                    assert {m["basis"] for m in degraded} == {"rating_unavailable"}
                    page.shoot_list(evidence / "t04-06-rating-signals-unavailable.png")
                finally:
                    with (
                        closing(sqlite3.connect(database_path)) as connection,
                        connection,
                    ):
                        connection.execute(
                            "ALTER TABLE ratings_held RENAME TO user_movie_ratings"
                        )
                checks["rating_source_failure_is_disclosed"] = "PASS"

                # 7. Account switch: B (no saved genres) never sees A's scores or reasons.
                sign_out_to_login(page)
                page.fill("#email", EMAIL_B)
                page.fill("#password", PASSWORD)
                page.click_text("button", "Sign in")
                page.wait_for(lambda s: EMAIL_B in s["headerText"], "B signed in")
                page.spa_navigate("/recommendations")
                state = page.wait_for(
                    lambda s: s["path"] == "/recommendations" and bool(s["cards"]),
                    "B popular list",
                )
                assert "Not personalised" in state["mainText"], state["mainText"]
                assert "Ranking score for you" not in state["mainText"]
                assert not any(
                    text in state["mainText"]
                    for text in (RAISED, LOWERED, UNCHANGED, UNAVAILABLE)
                )
                assert all(
                    c["ranking"] is None and c["reason"] is None for c in page.cards()
                )
                page.shoot_list(
                    evidence / "t04-07-popular-not-personalised-account-b.png"
                )
                checks[
                    "popular_mode_has_no_private_score_and_account_switch_isolated"
                ] = "PASS"
            finally:
                page.close()

        final = database_snapshot(database_path)
        assert final["ratings"] == [
            {"account": EMAIL_A, "movie_id": ZULU, "rating": 1}
        ], final
        assert final["preferences"] == [
            {"account": EMAIL_A, "genre_id": ACTION},
            {"account": EMAIL_A, "genre_id": COMEDY},
        ], final
        assert final["integrityCheck"] == "ok"
        (evidence / "t04-api-db-evidence.json").write_text(
            json.dumps(
                {
                    "fixture": "S4-T04 deterministic synthetic catalogue (raw popularity 80/80, one null)",
                    "api": api_evidence,
                    "layouts": layouts,
                    "finalDatabase": final,
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        remove_temporary_database(database_path)

    lines = [
        "S4 / T04 ranking score UI acceptance",
        f"run_at={datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"base_commit={git_output('rev-parse', 'HEAD')}",
        f"working_tree={'clean' if not source_status else 'local changes present'}",
        f"python={sys.version.split()[0]}",
        f"node={command_version([node_command(), '--version'])}",
        f"browser_product={browser_product}",
        f"browser_executable={browser_path.resolve()}",
        "database=migrated temporary file-backed SQLite",
        "catalogue=deterministic synthetic fixture, raw popularity 80/80 plus one null",
        *(f"{name}={value}" for name, value in checks.items()),
        f"database_integrity={final['integrityCheck']}",
        "independent_review=pending pull-request reviewer",
        "result=PASS",
        "",
    ]
    (evidence / "t04-browser-run-output.txt").write_text(
        "\n".join(lines), encoding="utf-8"
    )
    print("\n".join(lines), end="")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--browser", type=Path)
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
