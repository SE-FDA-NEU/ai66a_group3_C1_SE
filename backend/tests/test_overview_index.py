"""Real SQLite checks for the shared fitted overview index."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from app.db.database import Base
from app.db.models import CatalogMovie
from app.recommendations import overview_index as index_module
from app.recommendations.overview_index import (
    IndexUnavailable,
    load_active_index,
    rebuild_active_index,
)
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
)
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def catalogue(tmp_path: Path):
    database = tmp_path / "catalogue.db"
    engine = create_engine(f"sqlite:///{database.as_posix()}")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        revision = create_catalogue_revision(session, provider="synthetic")
        for movie_id, text in (
            ("opaque-a", "Astronaut rescue on the moon"),
            ("opaque-b", "A detective rescue case"),
            ("opaque-c", "the and"),
            ("opaque-d", None),
        ):
            session.add(CatalogMovie(
                id=movie_id, catalogue_revision_id=revision.id,
                source="synthetic", source_id=movie_id,
                title=movie_id, overview=text,
            ))
        activate_catalogue_revision(session, revision_id=revision.id)
    try:
        yield engine, database, tmp_path / "index.json"
    finally:
        engine.dispose()


def test_rebuild_persists_one_shared_transform_and_opaque_rows(catalogue):
    engine, _, path = catalogue
    with Session(engine) as session:
        built = rebuild_active_index(session, path)
    with Session(engine) as session:
        loaded = load_active_index(session, path)

    assert loaded.movie_ids == ("opaque-a", "opaque-b", "opaque-c", "opaque-d")
    assert loaded.id_to_row["opaque-b"] == 1
    assert loaded.document_count == 2
    assert loaded.idf == built.idf
    assert loaded.vector_for("opaque-a") == built.vector_for("opaque-a")
    assert loaded.has_usable_vector("opaque-a")
    assert not loaded.has_usable_vector("opaque-c")
    assert not loaded.has_usable_vector("opaque-d")
    query = loaded.transform_query("ASTRONAUT rescue moon")
    assert query
    assert index_module.cosine_similarity(query, loaded.vector_for("opaque-a")) > 0
    # Two usable vectors may have a valid cosine of zero; that differs from
    # missing/stop-word-only text and remains available to Similar ranking.
    assert index_module.cosine_similarity(
        loaded.vector_for("opaque-a"), loaded.transform_query("detective")
    ) == 0
    assert loaded.transform_query("unseenword") == {}
    assert set(json.loads(path.read_text(encoding="utf-8"))) == {
        "artifactVersion", "catalogueRevision", "corpusDigest",
        "configFingerprint", "documentCount", "movieIds", "idf",
        "vectors", "checksum",
    }


def test_text_and_mapping_changes_stale_but_media_does_not(catalogue, monkeypatch):
    engine, _, path = catalogue
    with Session(engine) as session:
        first = rebuild_active_index(session, path)
    original_bytes = path.read_bytes()
    with Session(engine) as session, session.begin():
        session.get(CatalogMovie, "opaque-a").poster_path = "/poster.jpg"
        session.get(CatalogMovie, "opaque-a").backdrop_path = "/backdrop.jpg"
    with Session(engine) as session:
        assert load_active_index(session, path).corpus_digest == first.corpus_digest

    def unexpected_fit(_snapshot):
        raise AssertionError("unchanged text must not fit again")

    with monkeypatch.context() as patcher:
        patcher.setattr(index_module, "_fit", unexpected_fit)
        with Session(engine) as session:
            rebuild_active_index(session, path)
    assert path.read_bytes() == original_bytes

    with Session(engine) as session, session.begin():
        session.get(CatalogMovie, "opaque-a").overview = "A different overview"
    with Session(engine) as session, pytest.raises(IndexUnavailable, match="stale"):
        load_active_index(session, path)
    with Session(engine) as session:
        rebuilt = rebuild_active_index(session, path)
    assert rebuilt.corpus_digest != first.corpus_digest

    with Session(engine) as session, session.begin():
        session.add(CatalogMovie(
            id="opaque-e", catalogue_revision_id=rebuilt.catalogue_revision,
            source="synthetic", source_id="opaque-e", title="E", overview=None,
        ))
    with Session(engine) as session, pytest.raises(IndexUnavailable, match="stale"):
        load_active_index(session, path)


def test_new_catalogue_revision_with_same_text_reuses_fitted_index(
    catalogue, monkeypatch,
):
    engine, _, path = catalogue
    with Session(engine) as session:
        first = rebuild_active_index(session, path)
    original_bytes = path.read_bytes()
    with Session(engine) as session, session.begin():
        revision = create_catalogue_revision(session, provider="synthetic")
        new_revision_id = revision.id
        for movie_id in first.movie_ids:
            movie = session.get(CatalogMovie, movie_id)
            movie.catalogue_revision_id = new_revision_id
            movie.poster_path = "/new-poster.jpg"
        activate_catalogue_revision(session, revision_id=new_revision_id)
    with Session(engine) as session:
        current = index_module.active_corpus(session)
        assert current.digest == first.corpus_digest
        assert index_module.config_fingerprint() == first.config_fingerprint
        loaded = load_active_index(session, path)
    assert loaded.catalogue_revision == new_revision_id
    assert loaded.built_catalogue_revision == first.catalogue_revision
    assert loaded.movie_ids == first.movie_ids

    def unexpected_fit(_snapshot):
        raise AssertionError("same corpus/config must reuse fitted index")

    with monkeypatch.context() as patcher:
        patcher.setattr(index_module, "_fit", unexpected_fit)
        with Session(engine) as session:
            rebuilt = rebuild_active_index(session, path)
    assert rebuilt.catalogue_revision == new_revision_id
    assert path.read_bytes() == original_bytes


def test_config_change_and_corrupt_artifact_are_unavailable(catalogue, monkeypatch):
    engine, _, path = catalogue
    with Session(engine) as session:
        rebuild_active_index(session, path)
    with monkeypatch.context() as patcher:
        patcher.setattr(index_module, "_CONFIG", {
            **index_module._CONFIG, "modelVersion": "overview-tfidf-v2"
        })
        with Session(engine) as session, pytest.raises(IndexUnavailable, match="stale"):
            load_active_index(session, path)

    raw = json.loads(path.read_text(encoding="utf-8"))
    raw["vectors"][0]["astronaut"] = 900
    path.write_text(json.dumps(raw), encoding="utf-8")
    with Session(engine) as session, pytest.raises(IndexUnavailable, match="checksum"):
        load_active_index(session, path)
    path.write_text("{not-json", encoding="utf-8")
    with Session(engine) as session, pytest.raises(IndexUnavailable):
        load_active_index(session, path)


def test_partial_build_failure_keeps_last_artifact_but_stale_text_stays_unready(
    catalogue, monkeypatch,
):
    engine, _, path = catalogue
    with Session(engine) as session:
        rebuild_active_index(session, path)
    original_bytes = path.read_bytes()
    with Session(engine) as session, session.begin():
        session.get(CatalogMovie, "opaque-b").overview = "Changed text"

    def fail_replace(_source, _target):
        raise OSError("synthetic replace failure")

    with monkeypatch.context() as patcher:
        patcher.setattr(index_module.os, "replace", fail_replace)
        with Session(engine) as session, pytest.raises(OSError, match="replace failure"):
            rebuild_active_index(session, path)
    assert path.read_bytes() == original_bytes
    assert not list(path.parent.glob(".index.json.*.tmp"))
    with Session(engine) as session, pytest.raises(IndexUnavailable, match="stale"):
        load_active_index(session, path)


def test_all_empty_corpus_is_ready_and_cli_reuses_it(catalogue):
    engine, database, path = catalogue
    with Session(engine) as session, session.begin():
        for movie_id in ("opaque-a", "opaque-b"):
            session.get(CatalogMovie, movie_id).overview = None
    environment = os.environ.copy()
    environment["DATABASE_URL"] = f"sqlite:///{database.as_posix()}"
    environment["PYTHONPATH"] = str(Path(__file__).parents[1])
    environment["TMDB_READ_ACCESS_TOKEN"] = ""
    environment["TMDB_NETWORK_DISABLED"] = "1"
    command = [
        sys.executable, "-m", "app.cli.rebuild_overview_index",
        "--path", str(path),
    ]
    missing = subprocess.run(
        [*command, "check"], env=environment, capture_output=True, text=True,
        check=False,
    )
    assert missing.returncode == 1
    built = subprocess.run(
        [*command, "rebuild"], env=environment, capture_output=True, text=True,
        check=False,
    )
    assert built.returncode == 0, built.stderr
    assert "usableDocuments=0" in built.stdout
    assert "vocabularyTerms=0" in built.stdout
    checked = subprocess.run(
        [*command, "check"], env=environment, capture_output=True, text=True,
        check=False,
    )
    assert checked.returncode == 0, checked.stderr
    with Session(engine) as session:
        index = load_active_index(session, path)
    assert index.document_count == 0
    assert index.idf == {}
    assert index.transform_query("astronaut rescue") == {}


def test_rebuild_command_on_clean_migrated_synthetic_database(tmp_path):
    root = Path(__file__).parents[2]
    database = tmp_path / "migrated.db"
    path = tmp_path / "migrated-index.json"
    environment = os.environ.copy()
    environment.update({
        "DATABASE_URL": f"sqlite:///{database.as_posix()}",
        "PYTHONPATH": str(root / "backend"),
        "NLP_INDEX_PATH": str(path),
        "TMDB_READ_ACCESS_TOKEN": "",
        "TMDB_NETWORK_DISABLED": "1",
    })
    migration = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini",
         "upgrade", "head"],
        cwd=root, env=environment, capture_output=True, text=True, check=False,
    )
    assert migration.returncode == 0, migration.stderr
    engine = create_engine(environment["DATABASE_URL"])
    try:
        with Session(engine) as session, session.begin():
            revision = create_catalogue_revision(session, provider="synthetic")
            session.add(CatalogMovie(
                id="opaque-migrated", catalogue_revision_id=revision.id,
                source="synthetic", source_id="1", title="Moon",
                overview="Astronaut rescue moon",
            ))
            activate_catalogue_revision(session, revision_id=revision.id)
        command = [sys.executable, "-m", "app.cli.rebuild_overview_index"]
        built = subprocess.run(
            [*command, "rebuild"], cwd=root, env=environment,
            capture_output=True, text=True, check=False,
        )
        assert built.returncode == 0, built.stderr
        assert "movies=1" in built.stdout
        assert "usableDocuments=1" in built.stdout
        checked = subprocess.run(
            [*command, "check"], cwd=root, env=environment,
            capture_output=True, text=True, check=False,
        )
        assert checked.returncode == 0, checked.stderr
        assert "ready=true" in checked.stdout
        loader = subprocess.run(
            [sys.executable, "-c", (
                "from app.db.database import SessionLocal; "
                "from app.recommendations.overview_index import load_active_index; "
                "session = SessionLocal(); "
                "print(load_active_index(session).movie_ids[0]); session.close()"
            )],
            cwd=root, env=environment, capture_output=True, text=True,
            check=False,
        )
        assert loader.returncode == 0, loader.stderr
        assert loader.stdout.strip() == "opaque-migrated"
    finally:
        engine.dispose()
