"""
AI-SERVICE-HARITA: api/main.py
- FastAPI uygulamasinin giris noktasi.
- Loglama ve CORS kurulumunu yapar.
- BackendClient, JobStore ve ScrapeService baglantilarini kurar.
- Route dosyalarini uygulamaya dahil eder.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from api.routes.scrape import router as scrape_router
from services.semantic_search_service import MilvusSemanticSearchService, SemanticSearchConfig
from services.scrape_service import ScrapeService
from utils.backend_client import BackendClient
from utils.config import settings
from utils.job_store import JobStore


def _configure_logging() -> None:
    logger.remove()
    logger.add(
        sys.stdout,
        colorize=True,
        format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}",
    )
    os.makedirs("logs", exist_ok=True)
    logger.add("logs/ai_service.log", rotation="10 MB", retention="7 days", encoding="utf-8")


def _parse_cors_origins(value: str) -> list[str]:
    origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
    return origins or ["http://localhost:5173"]


def create_app() -> FastAPI:
    _configure_logging()

    app = FastAPI(
        title="AI-Mevzuat AI Service",
        description="Resmi Gazete raw OCR pipeline servisi",
        version="0.3.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_parse_cors_origins(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    backend_client = BackendClient()
    job_store = JobStore(settings.jobs_state_file, max_history=300)
    scrape_service = ScrapeService(
        backend_client=backend_client,
        job_store=job_store,
        raw_output_root=Path("output/raw"),
    )
    semantic_search_service = MilvusSemanticSearchService(
        SemanticSearchConfig(
            enabled=settings.vectorization_enabled,
            model_name=settings.embedding_model,
            milvus_uri=settings.milvus_uri,
            milvus_token=settings.milvus_token,
            milvus_collection=settings.milvus_collection,
        )
    )

    app.state.scrape_service = scrape_service
    app.state.semantic_search_service = semantic_search_service
    app.include_router(scrape_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
