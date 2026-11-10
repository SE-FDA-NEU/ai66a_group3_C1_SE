"""Exercise the real S04 response gate controls without a browser or database."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from types import ModuleType

import httpx
import pytest


async def _fake_production_app(scope, _receive, send) -> None:
    body = json.dumps({"data": {"movies": [{"title": "Moon Rescue"}]}}).encode()
    await send({
        "type": "http.response.start", "status": 200,
        "headers": [(b"content-type", b"application/json")],
    })
    await send({"type": "http.response.body", "body": body})


def _harness(monkeypatch):
    scripts = Path(__file__).resolve().parents[1] / "scripts"
    monkeypatch.syspath_prepend(str(scripts))
    from s04_acceptance_server import build_harness

    production_module = ModuleType("app.main")
    production_module.app = _fake_production_app
    monkeypatch.setitem(sys.modules, "app.main", production_module)
    return build_harness(Path("unused-for-gate-controls.db"), {})


async def _captured(client: httpx.AsyncClient, name: str, count: int) -> dict:
    for _ in range(100):
        response = await client.get(f"/__acceptance/gates/{name}")
        if response.status_code == 200 and len(response.json()["responses"]) >= count:
            return response.json()
        await asyncio.sleep(0.01)
    raise AssertionError(f"gate {name} did not capture {count} responses")


def test_duplicate_and_cancelled_requests_are_scoped_and_drained(monkeypatch) -> None:
    async def check() -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=_harness(monkeypatch)),
            base_url="http://acceptance.test",
        ) as client:
            name = "similar-loading"
            path = "/api/movies/movie-a/similar"
            tag = "this-test-only"
            arm = await client.post(f"/__acceptance/gates/{name}/arm", json={
                "method": "GET", "path": path, "requestTag": tag,
            })
            assert arm.status_code == 200

            # Other movies and untagged API reads are never held by this gate.
            assert (await client.get("/api/movies/movie-b/similar", headers={"x-s04-gate": tag})).status_code == 200
            assert (await client.get(path)).status_code == 200
            first = asyncio.create_task(client.get(path, headers={"x-s04-gate": tag}))
            second = asyncio.create_task(client.get(path, headers={"x-s04-gate": tag}))
            captured = await _captured(client, name, 2)
            assert captured["pending"] == 2
            assert all(response["path"] == path and response["requestTag"] == tag
                       for response in captured["responses"])

            first.cancel()
            with pytest.raises(asyncio.CancelledError):
                await first
            release = await client.post("/__acceptance/release-gates")
            assert release.status_code == 200
            assert release.json() == {"released": 1, "pending": 0}
            assert (await second).status_code == 200
            assert (await client.get(f"/__acceptance/gates/{name}")).status_code == 404

    asyncio.run(check())


def test_failure_cleanup_allows_next_gate_without_500_or_unknown_gate(monkeypatch) -> None:
    async def check() -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=_harness(monkeypatch)),
            base_url="http://acceptance.test",
        ) as client:
            name = "similar-loading"
            path = "/api/movies/movie-a/similar"
            held = None
            with pytest.raises(AssertionError, match="intentional assertion failure"):
                try:
                    assert (await client.post(f"/__acceptance/gates/{name}/arm", json={
                        "method": "GET", "path": path, "requestTag": "first",
                    })).status_code == 200
                    held = asyncio.create_task(client.get(path, headers={"x-s04-gate": "first"}))
                    await _captured(client, name, 1)
                    raise AssertionError("intentional assertion failure")
                finally:
                    release = await client.post("/__acceptance/release-gates")
                    assert release.status_code == 200
                    assert release.json()["pending"] == 0
            assert held is not None and (await held).status_code == 200

            # A later test can reuse the name and receive its own response.
            assert (await client.post(f"/__acceptance/gates/{name}/arm", json={
                "method": "GET", "path": path, "requestTag": "second",
            })).status_code == 200
            next_request = asyncio.create_task(client.get(path, headers={"x-s04-gate": "second"}))
            captured = await _captured(client, name, 1)
            assert captured["responses"][0]["requestTag"] == "second"
            assert (await client.post("/__acceptance/release-gates")).json()["pending"] == 0
            assert (await next_request).status_code == 200

    asyncio.run(check())


@pytest.mark.parametrize(("path", "method"), [
    ("/api/movies/movie-a", "GET"),
    ("/api/me/ratings/movie-a", "GET"),
    ("/api/me/watchlist/movie-a", "GET"),
    ("/api/me/watchlist/movie-a", "PUT"),
])
def test_detail_widget_and_write_gates_keep_exact_method_path_and_tag(monkeypatch, path, method) -> None:
    async def check() -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=_harness(monkeypatch)),
            base_url="http://acceptance.test",
        ) as client:
            name, tag = "t16-widget", "selected-account-request"
            assert (await client.post(f"/__acceptance/gates/{name}/arm", json={
                "method": method, "path": path, "requestTag": tag,
            })).status_code == 200
            # Neither an untagged oracle nor another method/movie is held.
            assert (await client.request(method, path)).status_code == 200
            other = "PUT" if method == "GET" else "GET"
            assert (await client.request(other, path, headers={"x-s04-gate": tag})).status_code == 200
            assert (await client.request(method, path.replace("movie-a", "movie-b"),
                                         headers={"x-s04-gate": tag})).status_code == 200
            selected = asyncio.create_task(client.request(method, path, headers={"x-s04-gate": tag}))
            state = await _captured(client, name, 1)
            assert state["pending"] == 1
            assert [(row["method"], row["path"], row["requestTag"], row["status"])
                    for row in state["responses"]] == [(method, path, tag, 200)]
            assert (await client.post(f"/__acceptance/gates/{name}/seal")).status_code == 200
            assert (await client.post(f"/__acceptance/gates/{name}/release")).status_code == 200
            assert (await selected).status_code == 200
            state = (await client.get(f"/__acceptance/gates/{name}")).json()
            assert (state["completed"], state["pending"], state["aborted"]) == (1, 0, 0)
            assert (await client.post("/__acceptance/release-gates")).json() == {"released": 1, "pending": 0}

    asyncio.run(check())


@pytest.mark.parametrize(("match", "status"), [
    ({"path": "/api/auth/login", "method": "GET"}, 400),
    ({"path": "/api/movies/movie-a?other=1", "method": "GET"}, 400),
    ({"path": "/api/me/watchlist/movie-a", "method": "POST"}, 400),
    ({"paths": ["/api/movies/movie-a"], "methods": ["GET"]}, 422),
])
def test_invalid_or_obsolete_gate_matcher_is_rejected_before_capture(monkeypatch, match, status) -> None:
    async def check() -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=_harness(monkeypatch)),
            base_url="http://acceptance.test",
        ) as client:
            response = await client.post("/__acceptance/gates/invalid/arm", json=match)
            assert response.status_code == status
            assert (await client.post("/__acceptance/release-gates")).json() == {"released": 0, "pending": 0}

    asyncio.run(check())
