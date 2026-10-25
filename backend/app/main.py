import os
from collections.abc import Generator
from uuid import uuid4

from fastapi import Depends, FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.account_writes import begin_account_write
from app.db.database import SessionLocal, engine
from app.db.models import Genre, User, UserMovieRating
from app.recommendations.service import build_account_recommendations
from app.repositories.movies import (
    CatalogueSort,
    count_active_movies,
    get_active_catalogue_revision,
    get_active_movie_by_id,
    list_active_movies,
    to_movie_detail_dto,
    to_movie_summary_dto,
)
from app.repositories.preferences import (
    GenreNotFoundError,
    list_available_genres,
    list_user_preference_genres,
    replace_user_preference_genres,
)
from app.repositories.profile import reset_user_personalisation
from app.repositories.ratings import get_user_movie_rating, set_user_movie_rating
from app.repositories.recommendations import (
    count_popular_recommendation_movies,
    list_popular_recommendation_movies,
)
from app.repositories.users import create_user, get_user_by_email, to_user_dto
from app.repositories.watchlist import (
    add_movie,
    count_user_movies,
    list_user_movies,
    membership,
    remove_movie,
    utc_iso,
)
from app.schemas.auth import (
    AuthData,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
)
from app.schemas.movies import MovieDetailResponse, MovieListResponse
from app.schemas.preferences import (
    GenreListData,
    GenreListResponse,
    PreferenceRequest,
    PreferenceResponse,
)
from app.schemas.profile import (
    ProfileResetData,
    ProfileResetRequest,
    ProfileResetResponse,
    ProfileSummaryData,
    ProfileSummaryResponse,
)
from app.schemas.ratings import RatingData, RatingRequest, RatingResponse
from app.schemas.recommendations import RecommendationResponse
from app.schemas.watchlist import MembershipData, MembershipResponse, WatchlistResponse
from app.security.origin import same_origin_write_allowed
from app.security.passwords import normalize_email, verify_password
from app.security.sessions import (
    SESSION_COOKIE,
    SESSION_TTL,
    create_session,
    resolve_session,
    revoke_session,
)

app = FastAPI(
    title="AI Movie Recommendation System",
)

_SAME_ORIGIN_WRITES = frozenset(
    {
        ("POST", "/api/auth/login"),
        ("POST", "/api/auth/logout"),
        ("POST", "/api/me/profile/reset"),
        ("PUT", "/api/me/preferences"),
    }
)
_RATING_WRITE_PREFIX = "/api/me/ratings/"
_WATCHLIST_WRITE_PREFIX = "/api/me/watchlist/"


def _requires_same_origin(request: Request) -> bool:
    path = request.url.path
    return (request.method, path) in _SAME_ORIGIN_WRITES or (
        request.method == "PUT" and path.startswith(_RATING_WRITE_PREFIX)
    ) or (
        request.method in {"PUT", "DELETE"} and path.startswith(_WATCHLIST_WRITE_PREFIX)
    )


@app.middleware("http")
async def same_origin_account_writes(request: Request, call_next):
    """Reject cross-origin browser writes to sessions or account data."""

    if _requires_same_origin(request) and not same_origin_write_allowed(request):
        return _error(
            "ORIGIN_NOT_ALLOWED",
            "Request origin is not allowed",
            403,
        )
    return await call_next(request)


class AuthenticationRequiredError(Exception):
    """Raised when a protected route has no valid session."""


@app.exception_handler(AuthenticationRequiredError)
async def authentication_required_handler(
    _request: Request, _exc: AuthenticationRequiredError
):
    return _error("AUTHENTICATION_REQUIRED", "Authentication required", 401)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    if any(error.get("loc") == ("query", "genreId") for error in exc.errors()):
        return _error(
            "VALIDATION_ERROR",
            "genreId must be an integer from 1 to 2147483647",
            400,
        )
    return _error("VALIDATION_ERROR", "Please correct the highlighted fields", 400)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_request: Request, _exc: SQLAlchemyError):
    """Keep persistence failures inside the public API contract."""

    return _error(
        "SERVICE_UNAVAILABLE",
        "Service is temporarily unavailable",
        503,
    )


def get_db() -> Generator[Session, None, None]:
    database_session = SessionLocal()
    try:
        yield database_session
    finally:
        database_session.close()


def get_account_write_db(
    database_session: Session = Depends(get_db),  # noqa: B008
) -> Generator[Session, None, None]:
    """Reserve before reads and release on every non-committed request exit."""
    try:
        begin_account_write(database_session)
        yield database_session
    finally:
        # Also covers validation/auth/unknown-movie exits and acquisition errors.
        # Successful handlers already committed; rollback is then a no-op.
        database_session.rollback()


def current_account_write_user(
    request: Request,
    database_session: Session = Depends(get_account_write_db),  # noqa: B008
) -> User:
    """Rating writes keep auth-before-payload validation under the reservation."""
    user = resolve_session(database_session, request.cookies.get(SESSION_COOKIE))
    if user is None:
        raise AuthenticationRequiredError
    return user


def current_session_user(
    request: Request,
    database_session: Session = Depends(get_db),  # noqa: B008
) -> User:
    """Resolve the account from the cookie only.

    As a dependency this runs before FastAPI validates the body fields, so a
    missing session wins over a wrong rating value. JSON that is not
    syntactically valid is rejected earlier, while the body is parsed."""

    user = resolve_session(database_session, request.cookies.get(SESSION_COOKIE))
    if user is None:
        raise AuthenticationRequiredError
    return user


def _error(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "requestId": f"req_{uuid4().hex}",
            }
        },
    )


def _page_meta(*, count: int, limit: int, page: int, total: int,
               unfiltered_total: int, revision_id: str) -> dict:
    return {
        "count": count,
        "limit": limit,
        "page": page,
        "total": total,
        "totalPages": (total + limit - 1) // limit,
        "unfilteredTotal": unfiltered_total,
        "catalogueRevision": revision_id,
    }


def _revision_error(expected: str | None, actual: str) -> JSONResponse | None:
    if expected is not None and expected != actual:
        return _error("CATALOGUE_CHANGED", "Movie catalogue changed; reload page 1", 409)
    return None


def _unexpected_selectors(request: Request, allowed: frozenset[str] = frozenset()) -> bool:
    """Account-target fields are never accepted by current-account endpoints."""
    return any(key not in allowed or len(request.query_params.getlist(key)) != 1
               for key in request.query_params) or any(
        key in request.headers for key in ("x-user-id", "x-account-id", "x-owner-id")
    )


def _begin_read_snapshot(session: Session) -> None:
    """Keep a multi-query response on one SQLite read snapshot.

    Python's sqlite3 legacy transaction mode does not start a database
    transaction for SELECT. Explicit BEGIN keeps resets and imports from
    changing data between separate response queries. Test fixtures may
    already have an open DBAPI transaction, which is safe to reuse.
    """
    connection = session.connection()
    if connection.dialect.name == "sqlite":
        dbapi_connection = connection.connection.driver_connection
        if not dbapi_connection.in_transaction:
            connection.exec_driver_sql("BEGIN")


def _secure_cookie(request: Request) -> bool:
    configured = os.getenv("SESSION_COOKIE_SECURE")
    if configured is not None:
        return configured.lower() == "true"
    local_hosts = {"localhost", "127.0.0.1", "::1", "testserver"}
    return request.url.scheme == "https" or request.url.hostname not in local_hosts


def _set_session_cookie(response: Response, request: Request, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=_secure_cookie(request),
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        secure=_secure_cookie(request),
        httponly=True,
        samesite="lax",
        path="/",
    )


@app.get("/health")
def health():
    with engine.connect() as connection:
        migration_version = connection.execute(
            text("SELECT version_num FROM alembic_version")
        ).scalar_one_or_none()

    return {
        "status": "ok",
        "database": "connected",
        "migrationVersion": migration_version,
    }


@app.post("/api/auth/register", response_model=RegisterResponse, status_code=201)
def register(
    payload: RegisterRequest,
    database_session: Session = Depends(get_db),  # noqa: B008
):
    try:
        user_dto = create_user(
            database_session, email=payload.email, password=payload.password
        )
        database_session.commit()
    except IntegrityError:
        database_session.rollback()
        return _error(
            "EMAIL_ALREADY_REGISTERED",
            "This email is already registered",
            409,
        )
    return RegisterResponse(data=AuthData(user=user_dto))


@app.post("/api/auth/login", response_model=AuthResponse, status_code=200)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    database_session: Session = Depends(get_db),  # noqa: B008
):
    if not payload.email or not payload.password:
        return _error(
            "VALIDATION_ERROR",
            "Email and password are required",
            400,
        )

    try:
        email = normalize_email(payload.email)
    except (TypeError, ValueError):
        email = ""

    user = get_user_by_email(database_session, email=email) if email else None
    valid_password = verify_password(
        payload.password,
        user.password_hash if user is not None else _DUMMY_PASSWORD_HASH,
    )
    if user is None or not valid_password:
        return _error(
            "INVALID_CREDENTIALS",
            "Email or password is incorrect",
            401,
        )

    # A successful login always gets a fresh identity. An existing cookie is
    # revoked so logging in cannot leave an older identity usable.
    revoke_session(database_session, request.cookies.get(SESSION_COOKIE))
    token = create_session(database_session, user=user)
    database_session.commit()
    _set_session_cookie(response, request, token)
    return AuthResponse(data=AuthData(user=to_user_dto(user)))


@app.get("/api/auth/me", response_model=AuthResponse, status_code=200)
def current_user(
    request: Request,
    database_session: Session = Depends(get_db),  # noqa: B008
):
    user = resolve_session(
        database_session, request.cookies.get(SESSION_COOKIE)
    )
    if user is None:
        return _error(
            "AUTHENTICATION_REQUIRED", "Authentication required", 401
        )
    return AuthResponse(data=AuthData(user=to_user_dto(user)))


@app.post("/api/auth/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    database_session: Session = Depends(get_db),  # noqa: B008
):
    revoke_session(database_session, request.cookies.get(SESSION_COOKIE))
    database_session.commit()
    _clear_session_cookie(response, request)

@app.get(
    "/api/me/recommendations",
    response_model=RecommendationResponse,
    status_code=200,
)
def recommendations(
    request: Request,
    limit: int = Query(default=10, ge=1, le=10),
    page: int = Query(default=1, ge=1, le=10000),
    genre_id: int | None = Query(default=None, alias="genreId", ge=1, le=2147483647),
    catalogue_revision: str | None = Query(default=None, alias="catalogueRevision"),
    database_session: Session = Depends(get_db),  # noqa: B008
):
    _begin_read_snapshot(database_session)
    user = resolve_session(
        database_session,
        request.cookies.get(SESSION_COOKIE),
    )

    if user is None:
        return _error(
            "AUTHENTICATION_REQUIRED",
            "Authentication required",
            401,
        )

    revision = get_active_catalogue_revision(database_session)

    if revision is None:
        return _error(
            "CATALOGUE_UNAVAILABLE",
            "Movie catalogue is unavailable",
            503,
        )

    if error := _revision_error(catalogue_revision, revision.id):
        return error
    if genre_id is not None and database_session.get(Genre, genre_id) is None:
        return _error("GENRE_NOT_FOUND", "Genre not found", 400)

    result = build_account_recommendations(
        database_session,
        user_id=user.id,
        limit=limit,
        page=page,
        genre_id=genre_id,
    )

    return {
        "data": {
            "movies": [movie.model_dump() for movie in result.movies],
            "mode": result.mode,
            "personalised": result.personalised,
            "noMatch": result.no_match,
        },
        "meta": _page_meta(count=len(result.movies), limit=limit, page=page,
                           total=result.total, unfiltered_total=result.unfiltered_total,
                           revision_id=revision.id),
    }

@app.get("/api/genres", response_model=GenreListResponse, status_code=200)
def list_genres(
    request: Request,
    database_session: Session = Depends(get_db),  # noqa: B008
):
    user = resolve_session(
        database_session,
        request.cookies.get(SESSION_COOKIE),
    )
    if user is None:
        return _error(
            "AUTHENTICATION_REQUIRED", "Authentication required", 401
        )

    if get_active_catalogue_revision(database_session) is None:
        return _error(
            "CATALOGUE_UNAVAILABLE", "Movie catalogue is unavailable", 503
        )

    return {"data": {"genres": list_available_genres(database_session)}}


@app.get(
    "/api/me/preferences",
    response_model=PreferenceResponse,
    status_code=200,
)
def get_preferences(
    request: Request,
    database_session: Session = Depends(get_db),  # noqa: B008
):
    user = resolve_session(
        database_session,
        request.cookies.get(SESSION_COOKIE),
    )
    if user is None:
        return _error(
            "AUTHENTICATION_REQUIRED", "Authentication required", 401
        )

    return {
        "data": {
            "genres": list_user_preference_genres(
                database_session, user_id=user.id
            )
        }
    }


@app.put("/api/me/preferences", response_model=PreferenceResponse, status_code=200)
def put_preferences(
    payload: PreferenceRequest,
    request: Request,
    database_session: Session = Depends(get_account_write_db),  # noqa: B008
):
    try:
        user = resolve_session(database_session, request.cookies.get(SESSION_COOKIE))
        if user is None:
            return _error("AUTHENTICATION_REQUIRED", "Authentication required", 401)

        genres = replace_user_preference_genres(
            database_session, user_id=user.id, genre_ids=payload.genreIds
        )
        response = PreferenceResponse(data=GenreListData(genres=genres))
        database_session.commit()
    except GenreNotFoundError:
        database_session.rollback()
        return _error("GENRE_NOT_FOUND", "Genre not found", 404)
    except SQLAlchemyError:
        database_session.rollback()
        return _error("SERVICE_UNAVAILABLE", "Service is temporarily unavailable", 503)

    return response


@app.get("/api/me/profile", response_model=ProfileSummaryResponse)
def get_profile(
    request: Request,
    user: User = Depends(current_session_user),  # noqa: B008
    database_session: Session = Depends(get_db),  # noqa: B008
):
    if _unexpected_selectors(request):
        return _error("VALIDATION_ERROR", "Please correct the highlighted fields", 400)
    _begin_read_snapshot(database_session)
    genres = list_user_preference_genres(database_session, user_id=user.id)
    rating_count = database_session.scalar(select(func.count()).select_from(UserMovieRating).where(
        UserMovieRating.user_id == user.id
    )) or 0
    return ProfileSummaryResponse(data=ProfileSummaryData(
        genres=genres, ratingCount=rating_count,
        watchlistCount=count_user_movies(database_session, user_id=user.id),
    ))


@app.post(
    "/api/me/profile/reset",
    response_model=ProfileResetResponse,
    status_code=200,
)
def reset_profile(
    payload: ProfileResetRequest,
    request: Request,
    database_session: Session = Depends(get_account_write_db),  # noqa: B008
):
    try:
        user = resolve_session(
            database_session,
            request.cookies.get(SESSION_COOKIE),
        )
        if user is None:
            return _error(
                "AUTHENTICATION_REQUIRED",
                "Authentication required",
                401,
            )

        reset_user_personalisation(
            database_session,
            user_id=user.id,
        )
        response = ProfileResetResponse(
            data=ProfileResetData(reset=True),
        )
        database_session.commit()
    except SQLAlchemyError:
        database_session.rollback()
        return _error(
            "SERVICE_UNAVAILABLE",
            "Service is temporarily unavailable",
            503,
        )

    return response


@app.get("/api/me/watchlist", response_model=WatchlistResponse)
def get_watchlist(
    request: Request,
    page: int = Query(default=1, ge=1, le=10000),
    limit: int = Query(default=10, ge=1, le=10),
    catalogue_revision: str | None = Query(default=None, alias="catalogueRevision"),
    user: User = Depends(current_session_user),  # noqa: B008
    database_session: Session = Depends(get_db),  # noqa: B008
):
    if _unexpected_selectors(request, frozenset({"page", "limit", "catalogueRevision"})):
        return _error("VALIDATION_ERROR", "Please correct the highlighted fields", 400)
    _begin_read_snapshot(database_session)
    revision = get_active_catalogue_revision(database_session)
    if revision is None:
        return _error("CATALOGUE_UNAVAILABLE", "Movie catalogue is unavailable", 503)
    if error := _revision_error(catalogue_revision, revision.id):
        return error
    total = count_user_movies(database_session, user_id=user.id, active_only=True)
    rows = list_user_movies(database_session, user_id=user.id, page=page, limit=limit)
    movies = [to_movie_summary_dto(movie).model_dump() | {"addedAt": utc_iso(row.added_at)}
              for row, movie in rows]
    return {"data": {"movies": movies}, "meta": _page_meta(
        count=len(movies), limit=limit, page=page, total=total,
        unfiltered_total=total, revision_id=revision.id,
    )}


@app.get("/api/me/watchlist/{movie_id}", response_model=MembershipResponse)
def get_watchlist_membership(
    movie_id: str,
    request: Request,
    user: User = Depends(current_session_user),  # noqa: B008
    database_session: Session = Depends(get_db),  # noqa: B008
):
    if _unexpected_selectors(request):
        return _error("VALIDATION_ERROR", "Please correct the highlighted fields", 400)
    movie = get_active_movie_by_id(database_session, movie_id=movie_id)
    if movie is None:
        return _error("MOVIE_NOT_FOUND", "Movie not found", 404)
    row = membership(database_session, user_id=user.id, movie_id=movie.id)
    return MembershipResponse(data=MembershipData(
        movieId=movie.id, inWatchlist=row is not None,
        addedAt=utc_iso(row.added_at) if row is not None else None,
    ))


@app.put("/api/me/watchlist/{movie_id}", response_model=MembershipResponse)
@app.delete("/api/me/watchlist/{movie_id}", response_model=MembershipResponse, response_model_exclude_none=True)
async def write_watchlist_membership(
    movie_id: str,
    request: Request,
    user: User = Depends(current_account_write_user),  # noqa: B008
    database_session: Session = Depends(get_account_write_db),  # noqa: B008
):
    if _unexpected_selectors(request) or await request.body():
        return _error("VALIDATION_ERROR", "Please correct the highlighted fields", 400)
    movie = get_active_movie_by_id(database_session, movie_id=movie_id)
    if movie is None:
        return _error("MOVIE_NOT_FOUND", "Movie not found", 404)
    try:
        if request.method == "PUT":
            row = add_movie(database_session, user_id=user.id, movie_id=movie.id)
            result = MembershipResponse(data=MembershipData(
                movieId=movie.id, inWatchlist=True, addedAt=utc_iso(row.added_at),
            ))
        else:
            remove_movie(database_session, user_id=user.id, movie_id=movie.id)
            result = {"data": {"movieId": movie.id, "inWatchlist": False}}
        database_session.commit()
    except SQLAlchemyError:
        database_session.rollback()
        return _error("SERVICE_UNAVAILABLE", "Service is temporarily unavailable", 503)
    return result


@app.get(
    "/api/me/ratings/{movie_id}",
    response_model=RatingResponse,
    status_code=200,
)
def get_rating(
    movie_id: str,
    user: User = Depends(current_session_user),  # noqa: B008
    database_session: Session = Depends(get_db),  # noqa: B008
):
    movie = get_active_movie_by_id(database_session, movie_id=movie_id)
    if movie is None:
        return _error("MOVIE_NOT_FOUND", "Movie not found", 404)

    stored = get_user_movie_rating(
        database_session, user_id=user.id, movie_id=movie.id
    )
    return RatingResponse(
        data=RatingData(
            movieId=movie.id,
            rating=stored.rating if stored is not None else None,
        )
    )


@app.put(
    "/api/me/ratings/{movie_id}",
    response_model=RatingResponse,
    status_code=200,
)
def put_rating(
    movie_id: str,
    payload: RatingRequest,
    user: User = Depends(current_account_write_user),  # noqa: B008
    database_session: Session = Depends(get_account_write_db),  # noqa: B008
):
    movie = get_active_movie_by_id(database_session, movie_id=movie_id)
    if movie is None:
        return _error("MOVIE_NOT_FOUND", "Movie not found", 404)

    try:
        stored = set_user_movie_rating(
            database_session,
            user_id=user.id,
            movie_id=movie.id,
            rating=payload.rating,
        )
        response = RatingResponse(
            data=RatingData(movieId=movie.id, rating=stored.rating)
        )
        database_session.commit()
    except SQLAlchemyError:
        database_session.rollback()
        return _error("SERVICE_UNAVAILABLE", "Service is temporarily unavailable", 503)

    return response


@app.get("/api/movies", response_model=MovieListResponse, status_code=200)
def list_movies(
    limit: int = Query(default=10, ge=1, le=10),
    page: int = Query(default=1, ge=1, le=10000),
    sort: CatalogueSort = "title_asc",
    catalogue_revision: str | None = Query(default=None, alias="catalogueRevision"),
    database_session: Session = Depends(get_db),  # noqa: B008
):
    _begin_read_snapshot(database_session)
    revision = get_active_catalogue_revision(database_session)
    if revision is None:
        return _error(
            "CATALOGUE_UNAVAILABLE", "Movie catalogue is unavailable", 503
        )

    if error := _revision_error(catalogue_revision, revision.id):
        return error

    total = count_active_movies(database_session)
    movies = list_active_movies(database_session, limit=limit, page=page, sort=sort)
    return {
        "data": {
            "movies": [to_movie_summary_dto(movie).model_dump() for movie in movies]
        },
        "meta": _page_meta(count=len(movies), limit=limit, page=page,
                           total=total, unfiltered_total=total, revision_id=revision.id),
    }

@app.get(
    "/api/movies/popular",
    response_model=MovieListResponse,
    status_code=200,
)
def list_popular_movies(
    limit: int = Query(default=10, ge=1, le=10),
    page: int = Query(default=1, ge=1, le=10000),
    catalogue_revision: str | None = Query(default=None, alias="catalogueRevision"),
    database_session: Session = Depends(get_db),  # noqa: B008
):
    _begin_read_snapshot(database_session)
    revision = get_active_catalogue_revision(database_session)

    if revision is None:
        return _error(
            "CATALOGUE_UNAVAILABLE",
            "Movie catalogue is unavailable",
            503,
        )

    if error := _revision_error(catalogue_revision, revision.id):
        return error

    total = count_popular_recommendation_movies(database_session)
    movies = list_popular_recommendation_movies(
        database_session,
        limit=limit,
        page=page,
    )

    return {
        "data": {
            "movies": [
                to_movie_summary_dto(movie).model_dump()
                for movie in movies
            ]
        },
        "meta": _page_meta(count=len(movies), limit=limit, page=page,
                           total=total, unfiltered_total=total, revision_id=revision.id),
    }

@app.get("/api/movies/{movie_id}", response_model=MovieDetailResponse, status_code=200)
def get_movie(
    movie_id: str,
    database_session: Session = Depends(get_db),  # noqa: B008
):
    revision = get_active_catalogue_revision(database_session)
    if revision is None:
        return _error(
            "CATALOGUE_UNAVAILABLE", "Movie catalogue is unavailable", 503
        )

    movie = get_active_movie_by_id(database_session, movie_id=movie_id)
    if movie is None:
        return _error("MOVIE_NOT_FOUND", "Movie not found", 404)

    return {
        "data": {"movie": to_movie_detail_dto(movie).model_dump()},
        "meta": {"catalogueRevision": revision.id},
    }


# Used only to keep unknown-email verification on the same Argon2 path as a
# known account, preventing the response from identifying which field failed.
_DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$"
    "h6qrQH9mnU2BlE5+zY3mHA$"
    "OmtsPKfE9439waS1s/YJ6431AUHunXUiorIfT7qcbRA"
)
