"""Exercise early bootstrap in fresh pytest processes with hostile inherited env."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("invocation", ["pytest", "module", "collection-failure"])
def test_early_setup_isolates_collection_and_cleans_up(tmp_path, invocation):
    export = tmp_path / "export"
    export.mkdir()
    for name in ("pytest.ini", "conftest.py"):
        shutil.copy2(ROOT / name, export / name)
    # Rehearse without the developer .env or an existing application database.
    shutil.copytree(ROOT / "backend" / "app", export / "backend" / "app")
    shutil.copytree(ROOT / "backend" / "alembic", export / "backend" / "alembic")
    shutil.copy2(ROOT / "backend" / "alembic.ini", export / "backend" / "alembic.ini")
    tests = export / "tests"
    tests.mkdir()
    marker = tmp_path / "owned-path.txt"
    external_db = tmp_path / "external.db"
    external_db.write_bytes(b"external database must remain untouched")
    external_index = tmp_path / "external-index.json"
    external_index.write_text("external index must remain untouched")
    probe = '''
import os
from pathlib import Path
from app.main import app, engine
from fastapi.testclient import TestClient

database = Path(engine.url.database)
Path(os.environ["BOOTSTRAP_MARKER"]).write_text(str(database.parent))
assert database.is_file()
assert str(engine.url) == os.environ["DATABASE_URL"]
assert os.environ["TMDB_READ_ACCESS_TOKEN"] == ""
assert os.environ["TMDB_NETWORK_DISABLED"] == "1"
assert Path(os.environ["NLP_INDEX_PATH"]).parent == database.parent
assert TestClient(app).get("/health").status_code == 200
if os.environ["BOOTSTRAP_FAIL"] == "1":
    raise RuntimeError("intentional collection failure")

def test_default_engine():
    assert TestClient(app).get("/health").json()["migrationVersion"]
'''
    (tests / "test_probe.py").write_text(probe)
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment.update(
        DATABASE_URL=f"sqlite:///{external_db}",
        NLP_INDEX_PATH=str(external_index),
        TMDB_READ_ACCESS_TOKEN="synthetic-inherited-token",
        TMDB_NETWORK_DISABLED="0",
        BOOTSTRAP_MARKER=str(marker),
        BOOTSTRAP_FAIL="1" if invocation == "collection-failure" else "0",
    )
    command = (
        [str(Path(sys.executable).with_name("pytest"))]
        if invocation == "pytest" else [sys.executable, "-m", "pytest", "-v"]
    )
    result = subprocess.run(
        command, cwd=export, env=environment, capture_output=True, text=True,
        timeout=60, check=False,
    )
    assert result.returncode == (2 if invocation == "collection-failure" else 0), result.stdout + result.stderr
    assert marker.is_file(), result.stdout + result.stderr
    assert not Path(marker.read_text()).exists()
    assert external_db.read_bytes() == b"external database must remain untouched"
    assert external_index.read_text() == "external index must remain untouched"
    assert "synthetic-inherited-token" not in result.stdout + result.stderr
