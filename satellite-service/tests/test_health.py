from fastapi.testclient import TestClient

from main import create_app


def test_health_live():
    client = TestClient(create_app())
    r = client.get("/health/live")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
