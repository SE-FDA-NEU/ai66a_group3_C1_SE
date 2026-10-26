"""Deterministic regression for transient Chromium DevTools startup failures."""

from __future__ import annotations

import importlib
import io
import json
from http.client import RemoteDisconnected
from pathlib import Path
from types import SimpleNamespace
from urllib.error import URLError

import pytest

PAGE_URL = "ws://127.0.0.1:9222/devtools/page/ready"


@pytest.fixture
def readiness(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "scripts"))
    module = importlib.import_module("verify_s02_recommendations_ui")
    clock = SimpleNamespace(now=0.0)

    def sleep(seconds):
        clock.now += seconds

    monkeypatch.setattr(module, "time", SimpleNamespace(monotonic=lambda: clock.now, sleep=sleep))
    browser = SimpleNamespace(poll=lambda: None, returncode=None)
    port_file = tmp_path / "DevToolsActivePort"
    port_file.write_text("9222\n/devtools/browser/test\n", encoding="utf-8")
    return module, tmp_path, browser, clock, port_file


def reply(pages):
    return io.BytesIO(json.dumps(pages).encode())


def test_transient_devtools_connection_failures_retry_until_a_real_page_exists(readiness, monkeypatch):
    module, profile, browser, clock, _ = readiness
    attempts = []
    failures = [TimeoutError("startup timeout"), URLError("connection refused"), RemoteDisconnected("starting")]

    def open_url(url, timeout):
        attempts.append((url, timeout))
        if failures:
            raise failures.pop(0)
        return reply([{"type": "page", "webSocketDebuggerUrl": PAGE_URL}])

    monkeypatch.setattr(module, "urlopen", open_url)
    assert module.browser_websocket(profile, browser) == PAGE_URL
    assert len(attempts) == 4
    assert all(url == "http://127.0.0.1:9222/json/list" for url, _ in attempts)
    assert all(0 < timeout <= 2 for _, timeout in attempts)
    assert 0 < clock.now < 30


@pytest.mark.parametrize("initial", [[], {}, [None], [{"type": "service_worker"}],
                                   [{"type": "page"}], [{"type": "page", "webSocketDebuggerUrl": ""}]])
def test_incomplete_target_lists_are_not_ready_but_later_pages_are(readiness, monkeypatch, initial):
    module, profile, browser, _, _ = readiness
    replies = [initial, [{"type": "page", "webSocketDebuggerUrl": PAGE_URL}]]
    monkeypatch.setattr(module, "urlopen", lambda *_args, **_kwargs: reply(replies.pop(0)))
    assert module.browser_websocket(profile, browser) == PAGE_URL
    assert not replies


def test_partial_port_file_and_json_are_retried(readiness, monkeypatch):
    module, profile, browser, clock, port_file = readiness
    port_file.write_text("", encoding="utf-8")

    def sleep(seconds):
        clock.now += seconds
        port_file.write_text("9222\n/devtools/browser/test\n", encoding="utf-8")

    monkeypatch.setattr(module.time, "sleep", sleep)
    responses = [io.BytesIO(b"["), reply([{"type": "page", "webSocketDebuggerUrl": PAGE_URL}])]
    monkeypatch.setattr(module, "urlopen", lambda *_args, **_kwargs: responses.pop(0))
    assert module.browser_websocket(profile, browser) == PAGE_URL
    assert clock.now > 0


def test_persistent_timeout_exhausts_the_existing_deadline_and_never_claims_readiness(readiness, monkeypatch):
    module, profile, browser, clock, _ = readiness
    timeouts = []

    def fail(_url, timeout):
        timeouts.append(timeout)
        clock.now += timeout
        raise TimeoutError("still starting")

    monkeypatch.setattr(module, "urlopen", fail)
    with pytest.raises(TimeoutError, match="DevTools"):
        module.browser_websocket(profile, browser)
    assert clock.now == 30
    assert len(timeouts) > 1
    assert all(0 < timeout <= 2 for timeout in timeouts)


def test_absent_port_file_exhausts_the_deadline_without_network_requests(readiness, monkeypatch):
    module, profile, browser, clock, port_file = readiness
    port_file.unlink()

    def forbidden(*_args, **_kwargs):
        pytest.fail("must wait for a port before trying HTTP")

    monkeypatch.setattr(module, "urlopen", forbidden)
    with pytest.raises(TimeoutError, match="DevTools"):
        module.browser_websocket(profile, browser)
    assert clock.now == 30


def test_browser_exit_fails_immediately_without_waiting_or_http(readiness, monkeypatch):
    module, profile, browser, clock, _ = readiness
    browser.returncode = 7
    browser.poll = lambda: 7

    def forbidden(*_args, **_kwargs):
        pytest.fail("must not connect to a browser that has exited")

    monkeypatch.setattr(module, "urlopen", forbidden)
    with pytest.raises(RuntimeError, match="Chromium exited with 7"):
        module.browser_websocket(profile, browser)
    assert clock.now == 0
