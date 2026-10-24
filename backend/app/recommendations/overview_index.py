"""Versioned, offline TF-IDF transform shared by future Search and Similar reads.

Only active catalogue IDs and overviews enter the artifact. Consumers must call
``load_active_index`` before using vectors, so a stale or damaged artifact is
never confused with a movie whose overview happens to be empty.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
import unicodedata
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import PROJECT_ROOT
from app.db.models import CatalogMovie, CatalogueState

MODEL_VERSION = "overview-tfidf-v1"
ARTIFACT_VERSION = 1
DEFAULT_INDEX_PATH = PROJECT_ROOT / "data" / "overview-tfidf-v1.json"
STOP_WORDS = frozenset(
    {"a", "an", "and", "are", "at", "by", "for", "from", "in", "is", "it",
     "of", "on", "or", "that", "the", "to", "with"}
)
TOKEN_PATTERN = re.compile(r"[^\W_]+", flags=re.UNICODE)
_CONFIG = {
    "modelVersion": MODEL_VERSION,
    "normalization": "NFKC-casefold-strip",
    "tokenPattern": TOKEN_PATTERN.pattern,
    "stopWords": sorted(STOP_WORDS),
    "termFrequency": "count/tokenCount",
    "inverseDocumentFrequency": "ln((1+N)/(1+df))+1;N=nonempty-documents",
    "vector": "sparse-unnormalized",
    "similarity": "cosine",
}


class IndexUnavailable(Exception):
    """The artifact is absent, stale, corrupt, or cannot be read safely."""


def resolve_index_path(path: Path | None = None) -> Path:
    """Use one artifact location for CLI rebuilds and runtime consumers."""

    if path is not None:
        return path
    configured = os.environ.get("NLP_INDEX_PATH")
    return Path(configured) if configured and configured.strip() else DEFAULT_INDEX_PATH


def _canonical(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _digest(value: object) -> str:
    return hashlib.sha256(_canonical(value)).hexdigest()


def _reject_nonfinite(_value: str) -> None:
    raise ValueError("non-finite artifact value")


def config_fingerprint() -> str:
    """Fingerprint all preprocessing and vector rules, independently of text."""

    return _digest(_CONFIG)


def normalize_text(value: str | None) -> str:
    return unicodedata.normalize("NFKC", value or "").casefold().strip()


def tokenize(value: str | None) -> tuple[str, ...]:
    return tuple(
        token for token in TOKEN_PATTERN.findall(normalize_text(value))
        if token not in STOP_WORDS
    )


@dataclass(frozen=True)
class CorpusSnapshot:
    catalogue_revision: str
    documents: tuple[tuple[str, str], ...]

    @property
    def digest(self) -> str:
        return _digest(self.documents)


def active_corpus(session: Session) -> CorpusSnapshot:
    """Read active opaque IDs and normalized text, excluding media and accounts."""

    revision = session.scalar(
        select(CatalogueState.active_revision_id).where(CatalogueState.id == 1)
    )
    if revision is None:
        raise IndexUnavailable("no active catalogue")
    rows = session.execute(
        select(CatalogMovie.id, CatalogMovie.overview)
        .where(CatalogMovie.catalogue_revision_id == revision)
        .order_by(CatalogMovie.id)
    ).all()
    return CorpusSnapshot(
        catalogue_revision=revision,
        documents=tuple((movie_id, normalize_text(overview)) for movie_id, overview in rows),
    )


def _tfidf(tokens: Sequence[str], idf: Mapping[str, float]) -> dict[str, float]:
    if not tokens:
        return {}
    counts = Counter(tokens)
    return {
        token: (count / len(tokens)) * idf[token]
        for token, count in counts.items() if token in idf
    }


def cosine_similarity(first: Mapping[str, float], second: Mapping[str, float]) -> float:
    """Cosine zero is valid for two usable vectors with no shared terms."""

    if not first or not second:
        return 0.0
    dot = sum(value * second.get(token, 0.0) for token, value in first.items())
    first_norm = math.sqrt(sum(value * value for value in first.values()))
    second_norm = math.sqrt(sum(value * value for value in second.values()))
    if not first_norm or not second_norm:
        return 0.0
    return dot / (first_norm * second_norm)


@dataclass(frozen=True)
class OverviewIndex:
    catalogue_revision: str
    built_catalogue_revision: str
    corpus_digest: str
    config_fingerprint: str
    document_count: int
    movie_ids: tuple[str, ...]
    idf: Mapping[str, float]
    vectors: tuple[Mapping[str, float], ...]
    id_to_row: Mapping[str, int]

    def vector_for(self, movie_id: str) -> Mapping[str, float]:
        """Return a stored vector; unknown IDs are an integration error."""

        return self.vectors[self.id_to_row[movie_id]]

    def has_usable_vector(self, movie_id: str) -> bool:
        return bool(self.vector_for(movie_id))

    def transform_query(self, query: str) -> dict[str, float]:
        """Apply the fitted vocabulary and IDF without fitting again."""

        return _tfidf(tokenize(query), self.idf)

    def similarity(self, first_movie_id: str, second_movie_id: str) -> float:
        return cosine_similarity(
            self.vector_for(first_movie_id), self.vector_for(second_movie_id)
        )


def _fit(snapshot: CorpusSnapshot) -> dict[str, object]:
    token_rows = [tokenize(overview) for _, overview in snapshot.documents]
    usable = [tokens for tokens in token_rows if tokens]
    frequencies: Counter[str] = Counter()
    for tokens in usable:
        frequencies.update(set(tokens))
    count = len(usable)
    idf = {
        token: math.log((1 + count) / (1 + frequency)) + 1
        for token, frequency in frequencies.items()
    }
    return {
        "artifactVersion": ARTIFACT_VERSION,
        "catalogueRevision": snapshot.catalogue_revision,
        "corpusDigest": snapshot.digest,
        "configFingerprint": config_fingerprint(),
        "documentCount": count,
        "movieIds": [movie_id for movie_id, _ in snapshot.documents],
        "idf": idf,
        "vectors": [_tfidf(tokens, idf) for tokens in token_rows],
    }


def _validated_index(raw: object, snapshot: CorpusSnapshot) -> OverviewIndex:
    if not isinstance(raw, dict):
        raise IndexUnavailable("invalid artifact")
    checksum = raw.get("checksum")
    payload = {key: value for key, value in raw.items() if key != "checksum"}
    if not isinstance(checksum, str) or checksum != _digest(payload):
        raise IndexUnavailable("artifact checksum mismatch")
    if payload.get("artifactVersion") != ARTIFACT_VERSION:
        raise IndexUnavailable("unsupported artifact version")
    built_revision = payload.get("catalogueRevision")
    if not isinstance(built_revision, str) or not built_revision:
        raise IndexUnavailable("invalid catalogue provenance")
    if (payload.get("corpusDigest") != snapshot.digest
            or payload.get("configFingerprint") != config_fingerprint()):
        raise IndexUnavailable("index is stale")
    ids = payload.get("movieIds")
    vectors = payload.get("vectors")
    idf = payload.get("idf")
    count = payload.get("documentCount")
    if (not isinstance(ids, list) or not isinstance(vectors, list)
            or not isinstance(idf, dict) or not isinstance(count, int)
            or isinstance(count, bool) or count < 0
            or ids != [movie_id for movie_id, _ in snapshot.documents]
            or len(vectors) != len(ids) or len(set(ids)) != len(ids)):
        raise IndexUnavailable("invalid index mapping")
    if any(not isinstance(token, str) or not isinstance(value, (int, float))
           or isinstance(value, bool) or not math.isfinite(value) or value <= 0
           for token, value in idf.items()):
        raise IndexUnavailable("invalid vocabulary")
    for vector in vectors:
        if not isinstance(vector, dict) or any(
            token not in idf or not isinstance(value, (int, float))
            or isinstance(value, bool) or not math.isfinite(value) or value <= 0
            for token, value in vector.items()
        ):
            raise IndexUnavailable("invalid vector")
    if count != sum(bool(vector) for vector in vectors):
        raise IndexUnavailable("invalid document count")
    return OverviewIndex(
        catalogue_revision=snapshot.catalogue_revision,
        built_catalogue_revision=built_revision,
        corpus_digest=snapshot.digest,
        config_fingerprint=config_fingerprint(),
        document_count=count,
        movie_ids=tuple(ids),
        idf=idf,
        vectors=tuple(vectors),
        id_to_row={movie_id: row for row, movie_id in enumerate(ids)},
    )


def load_active_index(session: Session, path: Path | None = None) -> OverviewIndex:
    """Check live text/config/IDs and checksum before returning the fitted state."""

    snapshot = active_corpus(session)
    artifact_path = resolve_index_path(path)
    try:
        raw = json.loads(
            artifact_path.read_text(encoding="utf-8"), parse_constant=_reject_nonfinite
        )
        return _validated_index(raw, snapshot)
    except (OSError, UnicodeError, ValueError, TypeError, OverflowError) as exc:
        raise IndexUnavailable("index artifact cannot be read") from exc


def rebuild_active_index(session: Session, path: Path | None = None) -> OverviewIndex:
    """Fit once for the current key, then atomically replace the JSON artifact."""

    artifact_path = resolve_index_path(path)
    snapshot = active_corpus(session)
    try:
        return load_active_index(session, artifact_path)
    except IndexUnavailable:
        pass
    payload = _fit(snapshot)
    raw = {**payload, "checksum": _digest(payload)}
    _validated_index(raw, snapshot)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{artifact_path.name}.", suffix=".tmp",
            dir=artifact_path.parent, delete=False,
        ) as output:
            temporary = Path(output.name)
            output.write(_canonical(raw))
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, artifact_path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return load_active_index(session, artifact_path)
