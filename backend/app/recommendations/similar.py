"""Shared-genre Similar ranking over the fitted overview index."""

from __future__ import annotations

from collections.abc import Sequence

from app.db.models import CatalogMovie
from app.recommendations.overview_index import (
    IndexUnavailable,
    OverviewIndex,
    cosine_similarity,
)
from app.recommendations.ranker import score_title_id_ordering

SIMILAR_LIMIT = 5


def _popularity_order(movie: CatalogMovie):
    return score_title_id_ordering(
        movie.popularity_score, movie.title, movie.id, sql=False
    )


def rank_similar_movies(
    index: OverviewIndex, *, source: CatalogMovie, candidates: Sequence[CatalogMovie]
) -> list[CatalogMovie]:
    """Rank genre-eligible candidates and return at most ``SIMILAR_LIMIT``.

    Candidates with a usable overview vector come first, ordered by cosine to
    the source and then the shared popularity/title/ID order; a valid cosine of
    zero stays in this group. Candidates without a usable vector follow the
    whole group in popularity/title/ID order. A source without a usable vector
    ranks every candidate that way. An ID the index does not know is a broken
    index, never missing text.
    """

    distinct = {movie.id: movie for movie in candidates if movie.id != source.id}
    vectors = {
        movie_id: _vector(index, movie_id) for movie_id in (source.id, *distinct)
    }
    source_vector = vectors[source.id]

    if not source_vector:
        return sorted(distinct.values(), key=_popularity_order)[:SIMILAR_LIMIT]

    usable = sorted(
        (
            (cosine_similarity(source_vector, vectors[movie.id]), movie)
            for movie in distinct.values() if vectors[movie.id]
        ),
        key=lambda row: (-row[0], *_popularity_order(row[1])),
    )
    missing_text = sorted(
        (movie for movie in distinct.values() if not vectors[movie.id]),
        key=_popularity_order,
    )
    return ([movie for _, movie in usable] + missing_text)[:SIMILAR_LIMIT]


def _vector(index: OverviewIndex, movie_id: str):
    if movie_id not in index.id_to_row:
        raise IndexUnavailable("index mapping does not match active catalogue")
    return index.vector_for(movie_id)
