"""Shared migrated, offline SQLite fixture for the repository-root P0 suite."""

from collections.abc import Iterator
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import pytest


@pytest.fixture
def details(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[SimpleNamespace]:
    from test_s03_details import _details

    with TemporaryDirectory(prefix="p0-case-", dir=tmp_path) as directory:
        yield from _details(Path(directory), monkeypatch)
