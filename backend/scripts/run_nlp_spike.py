"""Run the deterministic TF-IDF/cosine experiment for Sprint 3 Spike #43.

This is research evidence, not a runtime recommendation service.  It reads a
small committed fixture and deliberately has no database, HTTP, TMDb, or
application-route dependency.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

DEFAULT_FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "fixtures"
    / "nlp-spike-movies.json"
)

# The spike fixes an English-language MVP baseline.  It intentionally avoids
# stemming, translation, synonym expansion, and any network-backed NLP model.
ENGLISH_STOP_WORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "at",
        "by",
        "for",
        "from",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "that",
        "the",
        "to",
        "with",
    }
)
TOKEN_PATTERN = re.compile(r"[^\W_]+", flags=re.UNICODE)


@dataclass(frozen=True)
class Movie:
    """Minimal local movie fixture used by the experiment."""

    id: str
    title: str
    genres: tuple[str, ...]
    popularity: float | None
    overview: str | None


@dataclass(frozen=True)
class RankedMovie:
    """A result together with the rule that determined its position."""

    movie: Movie
    score: float | None
    ranking_basis: str


def normalize_text(value: str | None) -> str:
    """Apply the fixed, deterministic text-normalisation rule for the spike."""

    if value is None:
        return ""
    return unicodedata.normalize("NFKC", value).casefold().strip()


def tokenize(value: str | None) -> tuple[str, ...]:
    """Return normalized, non-stop-word Unicode tokens without stemming."""

    normalized = normalize_text(value)
    return tuple(
        token
        for token in TOKEN_PATTERN.findall(normalized)
        if token not in ENGLISH_STOP_WORDS
    )


def _title_key(movie: Movie) -> tuple[str, str]:
    return (normalize_text(movie.title), movie.id)


def _popularity_key(movie: Movie) -> tuple[bool, float, str, str]:
    """Sort popularity descending, then title and opaque ID ascending."""

    missing_popularity = movie.popularity is None
    popularity = movie.popularity if movie.popularity is not None else 0.0
    return (missing_popularity, -popularity, *_title_key(movie))


def deduplicate_movies(movies: Iterable[Movie]) -> list[Movie]:
    """Keep one exact fixture row per ID and reject conflicting duplicates."""

    unique: dict[str, Movie] = {}
    for movie in movies:
        existing = unique.get(movie.id)
        if existing is None:
            unique[movie.id] = movie
        elif existing != movie:
            raise ValueError(f"conflicting duplicate fixture ID: {movie.id}")
    return list(unique.values())


def load_movies(path: Path = DEFAULT_FIXTURE_PATH) -> list[Movie]:
    """Load and validate the committed, local-only movie fixture."""

    raw_movies = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw_movies, list):
        raise TypeError("fixture root must be a JSON list")

    movies: list[Movie] = []
    for index, raw_movie in enumerate(raw_movies):
        if not isinstance(raw_movie, dict):
            raise TypeError(f"fixture entry {index} must be an object")

        movie_id = raw_movie.get("id")
        title = raw_movie.get("title")
        genres = raw_movie.get("genres")
        popularity = raw_movie.get("popularity")
        overview = raw_movie.get("overview")

        if not isinstance(movie_id, str) or not movie_id.strip():
            raise ValueError(f"fixture entry {index} has an invalid id")
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"fixture entry {index} has an invalid title")
        if not isinstance(genres, list) or not all(
            isinstance(genre, str) and genre.strip() for genre in genres
        ):
            raise ValueError(f"fixture entry {index} has invalid genres")
        if popularity is not None and (
            isinstance(popularity, bool)
            or not isinstance(popularity, (int, float))
            or not math.isfinite(float(popularity))
        ):
            raise ValueError(f"fixture entry {index} has invalid popularity")
        if overview is not None and not isinstance(overview, str):
            raise ValueError(f"fixture entry {index} has invalid overview")

        movies.append(
            Movie(
                id=movie_id,
                title=title,
                genres=tuple(genres),
                popularity=float(popularity) if popularity is not None else None,
                overview=overview,
            )
        )

    return deduplicate_movies(movies)


def build_tfidf_vectors(movies: Sequence[Movie]) -> dict[str, dict[str, float]]:
    """Build TF-IDF vectors from every non-empty overview in the local corpus."""

    token_sets = {movie.id: tokenize(movie.overview) for movie in movies}
    non_empty_documents = [
        tokens for tokens in token_sets.values() if tokens
    ]
    if not non_empty_documents:
        return {movie.id: {} for movie in movies}

    document_frequency: Counter[str] = Counter()
    for tokens in non_empty_documents:
        document_frequency.update(set(tokens))

    document_count = len(non_empty_documents)
    inverse_document_frequency = {
        token: math.log((1 + document_count) / (1 + frequency)) + 1
        for token, frequency in document_frequency.items()
    }

    return {
        movie.id: _tfidf_vector(
            token_sets[movie.id],
            inverse_document_frequency,
        )
        for movie in movies
    }


def _tfidf_vector(
    tokens: Sequence[str],
    inverse_document_frequency: dict[str, float],
) -> dict[str, float]:
    if not tokens:
        return {}

    token_count = len(tokens)
    frequencies = Counter(tokens)
    return {
        token: (count / token_count) * inverse_document_frequency[token]
        for token, count in frequencies.items()
        if token in inverse_document_frequency
    }


def cosine_similarity(
    first: dict[str, float],
    second: dict[str, float],
) -> float:
    """Return a deterministic cosine score; empty vectors have score zero."""

    if not first or not second:
        return 0.0

    dot_product = sum(
        value * second.get(token, 0.0) for token, value in first.items()
    )
    first_norm = math.sqrt(sum(value * value for value in first.values()))
    second_norm = math.sqrt(sum(value * value for value in second.values()))
    if first_norm == 0.0 or second_norm == 0.0:
        return 0.0
    return dot_product / (first_norm * second_norm)


def similar_movies(
    movies: Sequence[Movie],
    *,
    source_id: str,
    limit: int = 5,
) -> list[RankedMovie]:
    """Model the proposed S07 candidate and fallback policy using local data."""

    if not 1 <= limit <= 5:
        raise ValueError("similar-movie limit must be from 1 to 5")

    unique_movies = deduplicate_movies(movies)
    source = next((movie for movie in unique_movies if movie.id == source_id), None)
    if source is None:
        raise ValueError(f"unknown source movie: {source_id}")

    source_genres = set(source.genres)
    candidates = [
        movie
        for movie in unique_movies
        if movie.id != source.id and source_genres.intersection(movie.genres)
    ]

    vectors = build_tfidf_vectors(unique_movies)
    source_vector = vectors[source.id]
    if not source_vector:
        return [
            RankedMovie(movie, None, "source-text-fallback")
            for movie in sorted(candidates, key=_popularity_key)[:limit]
        ]

    candidates_with_text = [
        movie for movie in candidates if vectors[movie.id]
    ]
    missing_text_candidates = [
        movie for movie in candidates if not vectors[movie.id]
    ]
    text_ranked = [
        RankedMovie(
            movie,
            cosine_similarity(source_vector, vectors[movie.id]),
            "overview-cosine",
        )
        for movie in candidates_with_text
    ]
    text_ranked.sort(
        key=lambda result: (
            -(result.score or 0.0),
            *_popularity_key(result.movie),
        )
    )
    missing_text_ranked = [
        RankedMovie(movie, None, "missing-overview-fallback")
        for movie in sorted(missing_text_candidates, key=_popularity_key)
    ]
    return (text_ranked + missing_text_ranked)[:limit]


def search_movies(
    movies: Sequence[Movie],
    *,
    query: str,
) -> list[RankedMovie]:
    """Model the proposed S08 title-first, positive-cosine-only search policy."""

    if len(query.strip()) < 2:
        raise ValueError("Search query must contain at least 2 characters")

    unique_movies = deduplicate_movies(movies)
    normalized_query = normalize_text(query)
    title_matches = [
        movie
        for movie in unique_movies
        if normalized_query in normalize_text(movie.title)
    ]
    if title_matches:
        return [
            RankedMovie(movie, None, "literal-title")
            for movie in sorted(title_matches, key=_title_key)
        ]

    vectors = build_tfidf_vectors(unique_movies)
    document_frequency: Counter[str] = Counter()
    for vector in vectors.values():
        document_frequency.update(vector.keys())
    document_count = sum(1 for vector in vectors.values() if vector)
    inverse_document_frequency = {
        token: math.log((1 + document_count) / (1 + frequency)) + 1
        for token, frequency in document_frequency.items()
    }
    query_vector = _tfidf_vector(tokenize(query), inverse_document_frequency)

    ranked = [
        RankedMovie(
            movie,
            cosine_similarity(query_vector, vectors[movie.id]),
            "overview-cosine",
        )
        for movie in unique_movies
        if vectors[movie.id]
    ]
    positive_results = [result for result in ranked if (result.score or 0.0) > 0]
    positive_results.sort(
        key=lambda result: (-(result.score or 0.0), *_title_key(result.movie))
    )
    return positive_results


def serialize_results(results: Sequence[RankedMovie]) -> list[dict[str, Any]]:
    """Use JSON-friendly, rounded output for reviewable experiment evidence."""

    return [
        {
            "id": result.movie.id,
            "title": result.movie.title,
            "score": round(result.score, 6) if result.score is not None else None,
            "rankingBasis": result.ranking_basis,
        }
        for result in results
    ]


def run_experiment(movies: Sequence[Movie]) -> dict[str, Any]:
    """Run every decision case requested by Spike #43."""

    normal_similarity = similar_movies(movies, source_id="source-railway")
    missing_source_similarity = similar_movies(
        movies,
        source_id="silent-platform",
    )
    literal_title_search = search_movies(movies, query="ZEBRA")
    description_search = search_movies(
        movies,
        query="overnight detective train",
    )
    zero_score_search = search_movies(movies, query="volcano jazz galaxy")

    return {
        "s07NormalSimilarity": serialize_results(normal_similarity),
        "s07MissingSourceOverview": serialize_results(
            missing_source_similarity
        ),
        "s08LiteralTitleSearch": serialize_results(literal_title_search),
        "s08DescriptionSearch": serialize_results(description_search),
        "s08ZeroScoreSearch": serialize_results(zero_score_search),
        "s08ZeroScoreMessage": (
            "No movies found." if not zero_score_search else None
        ),
    }


def assert_expected_outcomes(results: dict[str, Any]) -> None:
    """Fail loudly if a later edit changes the decision evidence."""

    normal_ids = [row["id"] for row in results["s07NormalSimilarity"]]
    assert normal_ids == [
        "night-train",
        "zebra-case",
        "family-drama",
        "silent-platform",
    ]
    assert normal_ids.count("night-train") == 1
    assert "city-escape" not in normal_ids
    assert results["s07NormalSimilarity"][-1]["rankingBasis"] == (
        "missing-overview-fallback"
    )

    missing_source_ids = [
        row["id"] for row in results["s07MissingSourceOverview"]
    ]
    assert missing_source_ids == [
        "source-railway",
        "night-train",
        "zebra-case",
        "family-drama",
    ]
    assert {
        row["rankingBasis"] for row in results["s07MissingSourceOverview"]
    } == {"source-text-fallback"}

    assert [row["id"] for row in results["s08LiteralTitleSearch"]] == [
        "zebra-case"
    ]
    assert results["s08ZeroScoreSearch"] == []
    assert results["s08ZeroScoreMessage"] == "No movies found."


def format_report(results: dict[str, Any]) -> str:
    """Render concise human-readable output for the Spike report and review."""

    lines: list[str] = []
    for key in (
        "s07NormalSimilarity",
        "s07MissingSourceOverview",
        "s08LiteralTitleSearch",
        "s08DescriptionSearch",
        "s08ZeroScoreSearch",
    ):
        lines.append(f"{key}:")
        rows = results[key]
        if not rows:
            lines.append("  No movies found.")
        for row in rows:
            score = "n/a" if row["score"] is None else f"{row['score']:.6f}"
            lines.append(
                "  "
                f"{row['title']} ({row['id']}): "
                f"score={score}; basis={row['rankingBasis']}"
            )
        lines.append("")
    return "\n".join(lines).rstrip()


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the local deterministic TF-IDF/cosine Spike #43."
    )
    parser.add_argument(
        "--fixture",
        type=Path,
        default=DEFAULT_FIXTURE_PATH,
        help="Path to a local JSON fixture (default: committed spike fixture).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print stable machine-readable output instead of a text report.",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    movies = load_movies(arguments.fixture)
    results = run_experiment(movies)
    assert_expected_outcomes(results)
    if arguments.json:
        print(json.dumps(results, indent=2, sort_keys=True))
    else:
        print(format_report(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
