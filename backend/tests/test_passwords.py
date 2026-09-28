from app.security.passwords import hash_password, normalize_email, verify_password


def test_password_hash_is_argon2id_and_verifies() -> None:
    password_hash = hash_password("movie123")

    assert password_hash.startswith("$argon2id$")
    assert password_hash != "movie123"
    assert verify_password("movie123", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_invalid_hash_is_a_failed_verification() -> None:
    assert not verify_password("movie123", "not-a-password-hash")


def test_email_normalization_is_shared_by_account_boundaries() -> None:
    assert normalize_email("  VIEWER@Example.COM ") == "viewer@example.com"
