"""Prevent setup examples from silently falling back to one media batch."""

import re
import shlex
from pathlib import Path

import pytest
from app.cli import import_tmdb_catalogue as command
from app.integrations.tmdb import TmdbConfigurationError

ROOT = Path(__file__).resolve().parents[2]


def test_both_fresh_setup_sequences_migrate_import_then_enrich_trailers():
    setup = (ROOT / "docs/SETUP.md").read_text(encoding="utf-8")
    windows = setup.split("### Windows PowerShell", 1)[1].split("### Existing catalogues", 1)[0]
    posix = setup.split("### Windows PowerShell", 1)[0]
    for platform in (posix, windows):
        commands = ["-m alembic -c backend/alembic.ini upgrade head",
                    "-m app.cli.import_tmdb_catalogue --pages 50",
                    "-m app.cli.import_tmdb_catalogue --enrich-trailers --all",
                    "-m app.cli.rebuild_overview_index rebuild"]
        positions = [platform.index(value) for value in commands]
        assert positions == sorted(positions)
    repair = setup.split("### Existing catalogues", 1)[1].split("Runtime pages", 1)[0]
    for mode in ("posters", "backdrops", "trailers"):
        assert f"--enrich-{mode} --all" in repair


@pytest.mark.parametrize("document", ["README.md", "docs/SETUP.md",
                                    "docs/backdrop-import-runbook.md", "docs/trailer-import-runbook.md"])
def test_documented_import_commands_are_accepted_by_the_real_cli(document, monkeypatch):
    def offline_client():
        raise TmdbConfigurationError("offline CLI-argument validation")

    monkeypatch.setattr(command.TmdbClient, "from_environment", offline_client)
    blocks = re.findall(r"^```[^\n]*\n(.*?)^```", (ROOT / document).read_text(encoding="utf-8"), re.MULTILINE | re.DOTALL)
    validated = 0
    for block in blocks:
        for line in block.splitlines():
            if " -m app.cli.import_tmdb_catalogue " not in line:
                continue
            arguments = shlex.split(line.split(" -m app.cli.import_tmdb_catalogue ", 1)[1])
            # Returning the controlled configuration failure proves argparse
            # accepted the example without creating a client or touching a DB.
            assert command.main(arguments) == 1
            validated += 1
    assert validated > 0
