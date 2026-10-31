from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import get_db
from app.main import app

ORIGIN = settings.frontend_origin
OTHER = "http://evil.example"


def preflight(client, origin):
    return client.options(
        "/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )


def test_cors_allows_the_frontend_origin(client):
    r = preflight(client, ORIGIN)
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == ORIGIN
    assert r.headers["access-control-allow-credentials"] == "true"


def test_cors_refuses_other_origins(client):
    r = preflight(client, OTHER)
    assert r.status_code == 400
    assert "access-control-allow-origin" not in r.headers


def test_cors_headers_absent_on_simple_request_from_other_origin(client):
    r = client.get("/api/health", headers={"Origin": OTHER})
    assert "access-control-allow-origin" not in r.headers


def test_health_returns_500_without_leaking_details_when_db_is_down():
    class BrokenSession:
        def execute(self, *args, **kwargs):
            raise OperationalError("SELECT 1", {}, Exception("connexion refusée"))

    def broken_db():
        yield BrokenSession()

    app.dependency_overrides[get_db] = broken_db
    try:
        r = TestClient(app, raise_server_exceptions=False).get("/api/health")
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert r.status_code == 500
    assert "connexion refusée" not in r.text