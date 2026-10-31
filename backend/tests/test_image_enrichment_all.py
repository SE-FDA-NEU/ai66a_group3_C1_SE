"""All-catalogue media selection, transaction boundaries and CLI safety."""

from collections import Counter

import pytest
from app.catalogue.tmdb_import import import_tmdb_catalogue
from app.cli import import_tmdb_catalogue as command
from app.db.database import Base
from app.db.models import (
    CatalogMovie,
    User,
    UserGenrePreference,
    UserMovieRating,
    UserMovieWatchlist,
)
from app.integrations.tmdb import TmdbAuthenticationError, TmdbImportError
from sqlalchemy import create_engine, event, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker


class Gateway:
    def __init__(self, count):
        self.count = count
        self.calls = []
        self.fail_at = None
        self.failure = TmdbImportError("private provider body must not be printed")
        self.responses = {}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def fetch_genres(self):
        return [{"id": 28, "name": "Action"}]

    def fetch_popular_movies(self, _page):
        return [{"id": number, "title": f"Movie {number}", "genre_ids": [28],
                 "overview": "An unchanged overview", "popularity": number,
                 "poster_path": "/existing.jpg", "backdrop_path": "/existing.jpg"}
                for number in range(1000, 1000 + self.count)]

    def fetch_movie_details(self, number):
        self.calls.append(number)
        if number == self.fail_at:
            raise self.failure
        return self.responses.get(number, {
            "poster_path": f"/poster-{number}.jpg", "backdrop_path": f"/backdrop-{number}.jpg",
        })


@pytest.fixture
def catalogue(tmp_path):
    engines = []

    def prepare(count):
        engine = create_engine(f"sqlite:///{(tmp_path / str(len(engines))).as_posix()}.db")
        engines.append(engine)
        Base.metadata.create_all(engine)
        factory = sessionmaker(bind=engine)
        gateway = Gateway(count)
        with factory() as session, session.begin():
            import_tmdb_catalogue(session, client=gateway, pages=1)
            user = User(email_normalized="images@example.test", password_hash="synthetic-hash")
            session.add(user)
            session.flush()
            movie = session.scalar(select(CatalogMovie).order_by(CatalogMovie.source_id))
            session.add_all([
                UserGenrePreference(user_id=user.id, genre_id=28),
                UserMovieRating(user_id=user.id, movie_id=movie.id, rating=2.5),
                UserMovieWatchlist(user_id=user.id, movie_id=movie.id),
            ])
            movie.trailer_key = "AbCdEf123_-"
        return engine, factory, gateway

    yield prepare
    for engine in engines:
        engine.dispose()


def protected_snapshot(engine, media):
    with engine.connect() as connection:
        snapshot = {}
        for table in inspect(connection).get_table_names():
            columns = [column["name"] for column in inspect(connection).get_columns(table)
                       if not (table == "catalog_movies" and column["name"] == media + "_path")]
            projection = ",".join('"' + column + '"' for column in columns)
            snapshot[table] = sorted(connection.execute(text(
                'SELECT ' + projection + ' FROM "' + table + '"'
            )).all(), key=repr)
        return snapshot


def install(monkeypatch, factory, gateway):
    monkeypatch.setattr(command.TmdbClient, "from_environment", lambda: gateway)
    monkeypatch.setattr(command, "SessionLocal", factory)


@pytest.mark.parametrize("media", ["poster", "backdrop"])
@pytest.mark.parametrize("batch_size", [None, 127])
def test_cli_visits_all_1000_once_in_batches_and_preserves_every_other_field(
    catalogue, monkeypatch, capsys, media, batch_size,
):
    engine, factory, gateway = catalogue(1000)
    before = protected_snapshot(engine, media)
    install(monkeypatch, factory, gateway)
    arguments = [f"--enrich-{media}s", "--all"]
    if batch_size is not None:
        arguments.extend(["--limit", str(batch_size)])
    assert command.main(arguments) == 0
    output = capsys.readouterr().out
    assert "eligible=1000\nprocessed=1000\nupdated=1000\n" in output
    assert "remaining=0\n" in output
    assert Counter(gateway.calls) == Counter(range(1000, 2000))
    assert protected_snapshot(engine, media) == before
    with factory() as session:
        assert all(getattr(movie, media + "_path") == f"/{media}-{movie.source_id}.jpg"
                   for movie in session.scalars(select(CatalogMovie)))


@pytest.mark.parametrize("media", ["poster", "backdrop"])
def test_null_missing_invalid_and_unchanged_images_are_each_visited_once(catalogue, monkeypatch, capsys, media):
    _engine, factory, gateway = catalogue(5)
    gateway.responses = {
        1001: {media + "_path": None}, 1002: {},
        1003: {media + "_path": "https://unapproved.example/image.jpg"},
        1004: {media + "_path": "/existing.jpg"},
    }
    install(monkeypatch, factory, gateway)
    assert command.main([f"--enrich-{media}s", "--all", "--limit", "2"]) == 0
    assert gateway.calls == list(range(1000, 1005))
    output = capsys.readouterr().out
    assert "processed=5\nupdated=2\ncleared=1\nunchanged=1\nmissing=1\ninvalid=1\nremaining=0\n" in output


@pytest.mark.parametrize("media", ["poster", "backdrop"])
@pytest.mark.parametrize("failure", ["provider", "authentication", "database"])
def test_failed_batch_rolls_back_and_reports_only_committed_progress(
    catalogue, monkeypatch, capsys, media, failure,
):
    engine, factory, gateway = catalogue(5)
    install(monkeypatch, factory, gateway)
    if failure == "database":
        with factory() as session:
            fail_id = session.scalar(select(CatalogMovie.id).where(CatalogMovie.source_id == "1003"))

        def fail_update(_connection, _cursor, statement, parameters, _context, _many):
            if statement.startswith("UPDATE catalog_movies") and fail_id in parameters:
                raise SQLAlchemyError("private database body must not be printed")

        event.listen(engine, "before_cursor_execute", fail_update)
    else:
        gateway.fail_at = 1003
        if failure == "authentication":
            gateway.failure = TmdbAuthenticationError("private token must not be printed")
    assert command.main([f"--enrich-{media}s", "--all", "--limit", "2"]) == 1
    output = capsys.readouterr()
    assert "processed=2\nupdated=2\n" in output.out
    assert "remaining=3\n" in output.out
    assert "current batch rolled back" in output.err
    assert "private" not in output.out + output.err
    assert gateway.calls == [1000, 1001, 1002, 1003]
    with factory() as session:
        values = {movie.source_id: getattr(movie, media + "_path")
                  for movie in session.scalars(select(CatalogMovie))}
    assert values == {"1000": f"/{media}-1000.jpg", "1001": f"/{media}-1001.jpg",
                      "1002": "/existing.jpg", "1003": "/existing.jpg", "1004": "/existing.jpg"}


@pytest.mark.parametrize("media", ["poster", "backdrop"])
def test_revision_change_stops_before_fetching_the_next_batch(catalogue, monkeypatch, capsys, media):
    engine, factory, gateway = catalogue(5)
    calls = 0

    def changing_factory():
        nonlocal calls
        calls += 1
        if calls == 3:
            with engine.begin() as connection:
                connection.execute(text("DELETE FROM catalogue_state"))
        return factory()

    install(monkeypatch, changing_factory, gateway)
    assert command.main([f"--enrich-{media}s", "--all", "--limit", "2"]) == 1
    output = capsys.readouterr()
    assert "processed=2\n" in output.out and "remaining=3\n" in output.out
    assert "catalogue validation failed or changed" in output.err
    assert gateway.calls == [1000, 1001]
