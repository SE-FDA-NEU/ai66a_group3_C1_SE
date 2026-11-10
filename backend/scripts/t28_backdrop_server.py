"""Loopback-only T28 harness; never imported/mounted by production startup."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "backend/tests"))


def provenance(path: Path) -> dict:
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
        row = db.execute(
            "SELECT r.id,r.provider,r.created_at FROM catalogue_state s JOIN catalogue_revisions r ON r.id=s.active_revision_id WHERE s.id=1"
        ).fetchone()
        if row is None:
            raise ValueError("No active catalogue")
        from app.catalogue.backdrops import backdrop_url

        movies = db.execute(
            "SELECT id,source_id,title,backdrop_path,source_fetched_at FROM catalog_movies WHERE catalogue_revision_id=? ORDER BY popularity_score DESC,id",
            (row[0],),
        ).fetchall()
        return {
            "catalogueRevision": row[0],
            "provider": row[1],
            "importedAt": row[2],
            "activeCount": len(movies),
            "storedCount": db.execute("SELECT COUNT(*) FROM catalog_movies").fetchone()[
                0
            ],
            "withBackdrop": sum(backdrop_url(m[3]) is not None for m in movies),
            "movies": [
                {
                    "id": m[0],
                    "sourceId": m[1],
                    "title": m[2],
                    "backdropUrl": backdrop_url(m[3]),
                    "sourceFetchedAt": m[4],
                }
                for m in movies
            ],
        }


def prepare(path: Path, source: Path | None) -> dict:
    if path.exists():
        raise ValueError("Refusing to overwrite a database")
    if source:
        if not source.is_file() or source == path:
            raise ValueError("Live source must be an existing, different database")
        before = hashlib.sha256(source.read_bytes()).hexdigest()
        with (
            closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as src,
            closing(sqlite3.connect(path)) as dst,
        ):
            src.backup(dst)
        assert hashlib.sha256(source.read_bytes()).hexdigest() == before
    else:
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "alembic",
                "-c",
                "backend/alembic.ini",
                "upgrade",
                "head",
            ],
            cwd=ROOT,
            env=os.environ,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode:
            raise RuntimeError("Temporary database migration failed: " + result.stderr)
        from support.backdrop_acceptance import seed_database

        seed_database(path)
    result = provenance(path)
    if source:
        if result["provider"] != "tmdb" or not result["withBackdrop"]:
            raise ValueError("Live-image acceptance blocked: no imported TMDb backdrop")
        result["sourceDatabaseSha256"] = before
    return result


def build_app(path: Path, live: bool):
    from app.main import app as production_app
    from fastapi import FastAPI, HTTPException
    from support.backdrop_acceptance import audit_enrichment

    controls = FastAPI()
    gates = {}

    @controls.get("/__t28/ready")
    def ready():
        return {
            "mode": "manual-tmdb-copy" if live else "synthetic",
            "catalogue": provenance(path),
        }

    @controls.post("/__t28/enrich/{scenario}")
    def enrich(scenario: str):
        if live:
            raise HTTPException(404)
        return audit_enrichment(path, scenario)

    @controls.post("/__t28/hold")
    def hold(payload: dict):
        if live or payload.get("path") not in {
            "/api/movies/t28-movie-a",
            "/api/me/ratings/t28-movie-a",
            "/api/me/recommendations",
        }:
            raise HTTPException(400)
        name = payload["path"]
        if name in gates:
            raise HTTPException(409)
        gates[name] = {"event": asyncio.Event(), "captured": False}
        return {"armed": True}

    @controls.get("/__t28/gate")
    def gate_state():
        return {name: {"captured": gate["captured"]} for name, gate in gates.items()}

    @controls.post("/__t28/release")
    async def release():
        for gate in gates.values():
            gate["event"].set()
        return {"released": True}

    class DelayedRealResponses:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            gate = gates.get(scope.get("path"))
            if scope["type"] != "http" or not gate or gate["captured"]:
                return await self.app(scope, receive, send)
            messages = []

            async def capture(message):
                messages.append(message)

            await self.app(scope, receive, capture)
            gate["captured"] = True
            await asyncio.wait_for(gate["event"].wait(), timeout=25)
            for message in messages:
                await send(message)
            gates.pop(scope["path"], None)

    controls.mount("/", DelayedRealResponses(production_app))
    return controls


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--copy-from", type=Path)
    args = parser.parse_args()
    directory = Path(os.environ["T28_TEMP_DIR"]).resolve()
    path = Path(os.environ["T28_DATABASE_PATH"]).resolve()
    if path.parent != directory or not directory.name.startswith("t28-backdrop-"):
        raise ValueError("Only a runner-owned temporary database is allowed")
    os.environ["DATABASE_URL"] = f"sqlite:///{path.as_posix()}"
    os.environ["TMDB_READ_ACCESS_TOKEN"] = ""
    if args.prepare:
        print(
            json.dumps(
                prepare(path, args.copy_from.resolve() if args.copy_from else None)
            )
        )
        return
    import uvicorn

    uvicorn.run(
        build_app(path, os.environ.get("T28_LIVE") == "1"),
        host="127.0.0.1",
        port=8000,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
