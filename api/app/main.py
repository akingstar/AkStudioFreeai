import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_VERSION = "0.1.0"

origins = [
    item.strip()
    for item in os.getenv(
        "CORS_ORIGINS",
        "https://akingstar.github.io"
    ).split(",")
    if item.strip()
]

app = FastAPI(
    title="AkStudioFreeai API",
    description="Backend API for AkStudioFreeai music studio",
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

class MusicRequest(BaseModel):
    title: str = Field(default="Untitled", max_length=120)
    prompt: str = Field(min_length=3, max_length=2000)
    lyrics: str = Field(default="", max_length=10000)
    genre: str = Field(default="Pop", max_length=80)
    language: str = Field(default="Hindi", max_length=50)
    duration: int = Field(default=2, ge=1, le=5)
    instrumental: bool = False

@app.get("/")
def root():
    return {
        "name": "AkStudioFreeai API",
        "version": APP_VERSION,
        "status": "online",
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "akstudiofreeai-api",
        "version": APP_VERSION,
    }

@app.get("/api/v1/status")
def api_status():
    return {
        "api": "online",
        "music_engine": "not_connected",
        "voice_cloning": "not_connected",
        "stage": 4,
    }

@app.post("/api/v1/music/generate")
def generate_music(request: MusicRequest):
    # Real generation will be connected in Stage 5.
    raise HTTPException(
        status_code=503,
        detail={
            "code": "MUSIC_ENGINE_NOT_CONNECTED",
            "message": "AI music engine will be connected in Stage 5.",
        },
    )
