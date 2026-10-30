"""Operator smoke on a real imported DB; run outside pytest, never against user accounts."""

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
from contextlib import closing
from datetime import datetime
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "backend/app").is_dir())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--database", type=Path, required=True)
parser.add_argument("--index", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = {"runner": "Codex author verification", "date": datetime.now().astimezone().isoformat(),
          "testedCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
          "database": str(args.database), "checks": []}
with closing(sqlite3.connect(args.database.resolve().as_uri() + "?mode=ro", uri=True)) as source:
    source.row_factory = sqlite3.Row
    report["migrationHead"] = source.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    revision = dict(source.execute("SELECT r.* FROM catalogue_state s JOIN catalogue_revisions r "
                                   "ON r.id=s.active_revision_id WHERE s.id=1").fetchone())
    rows = [dict(r) for r in source.execute("SELECT m.* FROM catalog_movies m JOIN catalogue_state s "
                                           "ON s.active_revision_id=m.catalogue_revision_id")]
    report["revision"] = revision
    report["activeCount"] = len(rows)
    report["distinctSourceIds"] = len({r["source_id"] for r in rows})
    report["sources"] = sorted({r["source"] for r in rows})
    report["finitePopularityCount"] = sum(r["popularity_score"] is not None and
        abs(r["popularity_score"]) <= sys.float_info.max for r in rows)
    report["associatedGenres"] = source.execute("SELECT COUNT(DISTINCT mg.genre_id) FROM movie_genres mg "
        "JOIN catalog_movies m ON m.id=mg.movie_id JOIN catalogue_state s "
        "ON s.active_revision_id=m.catalogue_revision_id").fetchone()[0]
    report["fetchTimestampCount"] = sum(bool(r["source_fetched_at"]) for r in rows)
    report["firstFetchedAt"] = min(r["source_fetched_at"] for r in rows)
    report["lastFetchedAt"] = max(r["source_fetched_at"] for r in rows)
    report["sampleProvenance"] = [{k: r[k] for k in ("id", "source", "source_id", "source_fetched_at")}
                                  for r in sorted(rows, key=lambda r: r["source_id"])[:3]]
    for filename in ("api.db", "browser.db"):
        target_path = args.database.parent / filename
        if target_path.exists():
            raise RuntimeError(f"Refusing to replace prior acceptance database: {target_path}")
        with closing(sqlite3.connect(target_path)) as target:
            source.backup(target)

os.environ.update(DATABASE_URL=f"sqlite:///{args.database.parent / 'api.db'}",
                  NLP_INDEX_PATH=str(args.index), TMDB_READ_ACCESS_TOKEN="",
                  TMDB_NETWORK_DISABLED="1", SESSION_COOKIE_SECURE="false")
sys.path.insert(0, str(ROOT / "backend"))
from app.db.database import SessionLocal
from app.main import app, engine
from app.recommendations.overview_index import load_active_index
from fastapi.testclient import TestClient

assert revision["provider"] == "tmdb" and report["sources"] == ["tmdb"]
assert len(rows) == report["distinctSourceIds"] >= 10
assert report["fetchTimestampCount"] == len(rows)
with SessionLocal() as session:
    index = load_active_index(session)
    report["index"] = {"ready": True, "catalogueRevision": index.catalogue_revision,
        "corpusDigest": index.corpus_digest, "configFingerprint": index.config_fingerprint,
        "movies": len(index.movie_ids), "usableDocuments": index.document_count}
assert index.catalogue_revision == revision["id"] and len(index.movie_ids) == len(rows)

def check(client, method, path, status=200, **kwargs):
    response = client.request(method, path, **kwargs)
    assert response.status_code == status, (method, path, response.status_code, response.text)
    report["checks"].append({"method": method, "path": path, "status": response.status_code})
    return response.json() if response.content else None

with TestClient(app) as public:
    check(public, "GET", "/health")
    catalogue = check(public, "GET", "/api/movies?limit=10")
    assert catalogue["meta"]["total"] == len(rows)
    assert catalogue["meta"]["catalogueRevision"] == revision["id"]
    orders = {}
    for order in ("title_asc", "title_desc"):
        ids = []
        for page in range(1, catalogue["meta"]["totalPages"] + 1):
            result = check(public, "GET", f"/api/movies?limit=10&page={page}&sort={order}"
                           f"&catalogueRevision={revision['id']}")
            assert result["meta"]["total"] == len(rows)
            ids.extend(m["id"] for m in result["data"]["movies"])
        assert len(ids) == len(set(ids)) == len(rows)
        assert set(ids) == {r["id"] for r in rows}
        orders[order] = ids
    # Same title ties keep stable ID order, so compare titles rather than reverse IDs.
    titles = {r["id"]: r["title"] for r in rows}
    assert [titles[i] for i in orders["title_desc"]] == [titles[i] for i in orders["title_asc"]][::-1]
    popular = check(public, "GET", "/api/movies/popular?limit=10")
    movie = popular["data"]["movies"][0]
    report["topMovie"] = movie
    assert len({m["id"] for m in popular["data"]["movies"]}) == 10
    scores = [m["popularityScore"] for m in popular["data"]["movies"]]
    assert scores == sorted(scores, reverse=True)
    detail = check(public, "GET", f"/api/movies/{movie['id']}")
    assert detail["data"]["movie"]["title"] == movie["title"]
    similar = check(public, "GET", f"/api/movies/{movie['id']}/similar")
    assert 0 < len(similar["data"]["movies"]) <= 5
    assert movie["id"] not in [m["id"] for m in similar["data"]["movies"]]
    check(public, "GET", "/api/movies/search", params={"q": movie["title"]})
    query = next(" ".join(re.findall(r"[a-zA-Z]+", r["overview"])[2:5]) for r in rows
        if r["overview"] and len(re.findall(r"[a-zA-Z]+", r["overview"])) > 8
        and not any(" ".join(re.findall(r"[a-zA-Z]+", r["overview"])[2:5]).lower()
                    in title.lower() for title in titles.values()))
    description = check(public, "GET", "/api/movies/search", params={"q": query})
    assert description["meta"]["total"] > 0
    report["descriptionQuery"] = query
    report["descriptionTitleMatchesInSql"] = sum(query.lower() in title.lower() for title in titles.values())
    report["descriptionResultTotal"] = description["meta"]["total"]
    check(public, "GET", "/api/me/watchlist", 401)
    check(public, "GET", "/api/me/recommendations", 401)

with TestClient(app, headers={"Origin": "http://testserver"}) as account:
    credentials = {"email": "t18-api@example.test", "password": "Synthetic-t18-password"}
    check(account, "POST", "/api/auth/register", 201, json=credentials)
    check(account, "POST", "/api/auth/login", json=credentials)
    cold = check(account, "GET", "/api/me/recommendations")
    assert cold["data"]["mode"] == "popular" and not cold["data"]["noMatch"]
    assert [m["id"] for m in cold["data"]["movies"]] == [m["id"] for m in popular["data"]["movies"]]
    check(account, "PUT", "/api/me/preferences", json={"genreIds": [movie["genres"][0]["id"]]})
    assert check(account, "GET", "/api/me/recommendations")["data"]["mode"] == "personalised"
    assert check(account, "GET", f"/api/me/ratings/{movie['id']}")["data"]["rating"] is None
    check(account, "PUT", f"/api/me/ratings/{movie['id']}", json={"rating": 4.5})
    assert check(account, "GET", f"/api/me/ratings/{movie['id']}")["data"]["rating"] == 4.5
    check(account, "PUT", f"/api/me/watchlist/{movie['id']}")
    check(account, "POST", "/api/me/profile/reset", json={"confirm": True})
    assert check(account, "GET", "/api/me/preferences")["data"]["genres"] == []
    assert check(account, "GET", f"/api/me/ratings/{movie['id']}")["data"]["rating"] is None
    assert check(account, "GET", f"/api/me/watchlist/{movie['id']}")["data"]["inWatchlist"]
    assert check(account, "GET", "/api/me/recommendations")["data"]["mode"] == "popular"
engine.dispose()
report["status"] = "PASS"
(args.output / "resumed-live-provenance-api.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"status": report["status"], "movies": len(rows), "checks": len(report["checks"]),
                  "descriptionQuery": query, "index": report["index"]}, indent=2))
