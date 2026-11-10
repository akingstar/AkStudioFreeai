from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["name"] == "AkStudioFreeai API"

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_api_status():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    assert response.json()["stage"] == 4

def test_generation_not_faked():
    response = client.post(
        "/api/v1/music/generate",
        json={"prompt": "Hindi romantic song"}
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "MUSIC_ENGINE_NOT_CONNECTED"
