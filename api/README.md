# AkStudioFreeai Backend

FastAPI foundation for the AkStudioFreeai web studio.

## Endpoints

- `GET /` - API information
- `GET /health` - health check
- `GET /api/v1/status` - engine connection status
- `POST /api/v1/music/generate` - reserved generation endpoint

## Run locally or on a server

Python 3.12 recommended.

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Set `CORS_ORIGINS` to the exact trusted frontend origins.

The music endpoint intentionally returns HTTP 503 until a real
music-generation model is connected. No fake audio is generated.

Voice cloning and music generation are not active in this stage.
