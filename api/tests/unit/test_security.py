from app.core.security import hash_password, verify_password


def test_hash_is_not_plaintext():
    hashed = hash_password("MonMotDePasse1!")
    assert hashed != "MonMotDePasse1!"
    assert hashed.startswith("$argon2")


def test_verify_accepts_correct_password():
    hashed = hash_password("MonMotDePasse1!")
    assert verify_password("MonMotDePasse1!", hashed) is True


def test_verify_rejects_wrong_password():
    hashed = hash_password("MonMotDePasse1!")
    assert verify_password("autre-mot-de-passe", hashed) is False


def test_same_password_gives_different_hashes():
    assert hash_password("abc12345") != hash_password("abc12345")