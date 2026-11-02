import importlib
import pytest
from fastapi.testclient import TestClient

@pytest.fixture()
def module(monkeypatch):
    monkeypatch.setenv("DASHBOARD_API_TOKEN", "test-secret")
    monkeypatch.setenv("DASHBOARD_ALLOWED_ORIGINS", "https://example.test")
    import server.main
    return importlib.reload(server.main)

def test_health_and_read(module):
    with TestClient(module.app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/api/status").status_code == 200

def test_write_requires_auth_and_updates(module):
    with TestClient(module.app) as client:
        body = {"status": "Ready", "message": "Server live"}
        assert client.post("/api/status", json=body).status_code == 401
        result = client.post("/api/status", json=body, headers={"Authorization": "Bearer test-secret"})
        assert result.status_code == 200
        assert result.json()["data"]["status"] == "Ready"

def test_read_only_websocket_and_live_broadcast(module):
    with TestClient(module.app) as client:
        with client.websocket_connect("/ws") as ws:
            assert ws.receive_json()["type"] == "INIT_STATE"
            result = client.post("/api/status", json={"status": "Updated", "message": "Live"},
                headers={"Authorization": "Bearer test-secret"})
            assert result.status_code == 200
            assert ws.receive_json()["type"] == "STATE_UPDATE"

def test_invalid_websocket_token_is_rejected(module):
    with TestClient(module.app) as client:
        with pytest.raises(Exception):
            with client.websocket_connect("/ws?token=bad"):
                pass
