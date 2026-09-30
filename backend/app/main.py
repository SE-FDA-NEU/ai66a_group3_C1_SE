import os
from collections.abc import Generator
from uuid import uuid4

from fastapi import Depends, FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import SessionLocal, engine
from app.repositories.movies import (
    get_active_catalogue_revision,
    get_active_movie_by_id,
    list_active_movies,
    to_movie_detail_dto,
    to_movie_summary_dto,
)
from app.repositories.users import get_user_by_email, to_user_dto
from app.schemas.auth import AuthData, AuthResponse, LoginRequest
from app.schemas.movies import MovieDetailResponse, MovieListResponse
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

_SESSION_WRITE_PATHS = frozenset({"/api/auth/login", "/api/auth/logout"})


@app.middleware("http")
async def same_origin_session_writes(request: Request, call_next):
    """Reject cross-origin browser requests before they can change a session."""

    if (
        request.method == "POST"
        and request.url.path in _SESSION_WRITE_PATHS
        and not same_origin_write_allowed(request)
    ):
        return _error(
            "ORIGIN_NOT_ALLOWED",
            "Request origin is not allowed",
            403,
        )
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, _exc: RequestValidationError):
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


@app.get("/api/movies", response_model=MovieListResponse, status_code=200)
def list_movies(
    limit: int = Query(default=10, ge=1, le=10),
    database_session: Session = Depends(get_db),  # noqa: B008
):
    revision = get_active_catalogue_revision(database_session)
    if revision is None:
        return _error(
            "CATALOGUE_UNAVAILABLE", "Movie catalogue is unavailable", 503
        )

    movies = list_active_movies(database_session, limit=limit)
    return {
        "data": {
            "movies": [to_movie_summary_dto(movie).model_dump() for movie in movies]
        },
        "meta": {
            "count": len(movies),
            "limit": limit,
            "catalogueRevision": revision.id,
        },
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
