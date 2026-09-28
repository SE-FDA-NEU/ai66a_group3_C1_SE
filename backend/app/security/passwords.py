"""Password hashing boundary.

Application code should call these functions and persist only the returned
hash.  The concrete Argon2 configuration remains local to this module so it
can be changed without coupling account or authentication code to the library.
"""

from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Return an Argon2id hash for a plaintext password."""

    if not isinstance(password, str):
        raise TypeError("password must be a string")
    if not password:
        raise ValueError("password must not be empty")
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored hash.

    Invalid or non-matching hashes are treated as failed authentication.  The
    caller never needs to know which Argon2 exception was raised.
    """

    if not isinstance(password, str) or not isinstance(password_hash, str):
        return False

    try:
        return _password_hasher.verify(password_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def normalize_email(email: str) -> str:
    """Return the canonical email value used for account uniqueness checks."""

    if not isinstance(email, str):
        raise TypeError("email must be a string")
    normalized = email.strip().lower()
    if not normalized:
        raise ValueError("email must not be empty")
    return normalized
