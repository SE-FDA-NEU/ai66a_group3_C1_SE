"""Positive-cosine description search over the fitted shared overview index."""

from __future__ import annotations

from collections.abc import Sequence

from app.db.models import CatalogMovie
from app.recommendations.overview_index import (
    IndexUnavailable,
    OverviewIndex,
    cosine_similarity,
    normalize_text,
)


def rank_description_matches(
    index: OverviewIndex, *, query: str, movies: Sequence[CatalogMovie]
) -> list[CatalogMovie]:
    """Rank every positive match; pagination belongs to the API boundary."""

    query_vector = index.transform_query(query)
    if not query_vector:
        return []
    ranked: list[tuple[float, CatalogMovie]] = []
    seen: set[str] = set()
    for movie in movies:
        if movie.id in seen:
            continue
        seen.add(movie.id)
        if movie.id not in index.id_to_row:
            raise IndexUnavailable("index mapping does not match active catalogue")
        score = cosine_similarity(query_vector, index.vector_for(movie.id))
        if score > 0:
            ranked.append((score, movie))
    ranked.sort(key=lambda row: (-row[0], normalize_text(row[1].title), row[1].id))
    return [movie for _, movie in ranked]
