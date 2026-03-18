"""
app/main.py - FastAPI application factory
"""

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1 import auth, emotions, recommendations, songs, websocket, uploads, voice_emotion
from app.core.config import settings
from app.database import create_tables
from app.ml import emotion_detector

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ]
)
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    log.info("Starting EmotiTune API", env=settings.APP_ENV)
    if settings.APP_ENV == "development":
        await create_tables()
        log.info("Database tables ensured")
    emotion_detector.load_model(settings.EMOTION_MODEL_PATH)
    log.info("Emotion detection model loaded")
    if settings.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.SENTRY_DSN, environment=settings.APP_ENV)
    yield
    log.info("Shutting down EmotiTune API")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        description="Emotion-Based Music Recommendation API",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url=f"{settings.API_V1_PREFIX}/docs",
        redoc_url=f"{settings.API_V1_PREFIX}/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_timing(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        response.headers["X-Process-Time"] = f"{elapsed:.4f}s"
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception(_request: Request, exc: Exception):
        log.exception("Unhandled exception", exc=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "ok", "version": "1.0.0", "environment": settings.APP_ENV}

    # API routers
    prefix = settings.API_V1_PREFIX
    app.include_router(auth.router,            prefix=prefix)
    app.include_router(emotions.router,        prefix=prefix)
    app.include_router(songs.router,           prefix=prefix)
    app.include_router(recommendations.router, prefix=prefix)
    app.include_router(websocket.router)
    app.include_router(uploads.router, prefix=prefix)
    app.include_router(voice_emotion.router, prefix=prefix)

    # Serve uploaded audio files
    uploads_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "songs")
    )
    os.makedirs(uploads_dir, exist_ok=True)
    app.mount("/uploads/songs", StaticFiles(directory=uploads_dir), name="uploads")

    # Frontend static files
    dist_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
    )

    if os.path.exists(dist_dir):
        assets_dir = os.path.join(dist_dir, "assets")
        if os.path.exists(assets_dir):
            # Mount assets FIRST so CSS/JS load correctly
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        # Explicit SPA routes
        index_file = os.path.join(dist_dir, "index.html")

        @app.get("/", include_in_schema=False)
        async def serve_root():
            return FileResponse(index_file)

        @app.get("/login", include_in_schema=False)
        async def serve_login():
            return FileResponse(index_file)

        @app.get("/register", include_in_schema=False)
        async def serve_register():
            return FileResponse(index_file)

        @app.get("/dashboard", include_in_schema=False)
        async def serve_dashboard():
            return FileResponse(index_file)

        @app.get("/upload", include_in_schema=False)
        async def serve_upload():
            return FileResponse(index_file)

        # Generic fallback for any other non-API route
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str):
            file_path = os.path.join(dist_dir, full_path)
            if full_path and os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(index_file)

    return app


app = create_app()
