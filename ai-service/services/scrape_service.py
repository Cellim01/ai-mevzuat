"""
AI-SERVICE-HARITA: services/scrape_service.py
- Raw OCR pipeline akisini uctan uca yonetir.
- Stage12 calistirir, ciktilari donusturur, backend ingest yapar.
- Kalici job durumunu gunceller ve route katmanina sonuc dondurur.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, date
from pathlib import Path

from fastapi.responses import JSONResponse
from loguru import logger

from api.schemas.scrape import RawScrapeRequest
from scripts.ocr_utils import OcrConfig
from scripts.rg_stage12_pipeline import run_pipeline
from services.transform_service import raw_rows_to_scrape_result
from utils.backend_client import BackendClient
from utils.config import settings
from utils.job_store import JobStore
from utils.raw_reader import read_raw_output_bundle, read_raw_rows


class ScrapeService:
    def __init__(
        self,
        backend_client: BackendClient,
        job_store: JobStore,
        raw_output_root: Path,
    ) -> None:
        self.backend_client = backend_client
        self.job_store = job_store
        self.raw_output_root = raw_output_root

    async def health(self) -> dict:
        backend_ok = await self.backend_client.health_check()
        return {
            "status": "ok",
            "service": "ai-mevzuat-ai-service",
            "version": "0.3.0",
            "backend_reachable": backend_ok,
        }

    def get_job(self, job_id: str) -> dict | None:
        return self.job_store.get(job_id)

    def list_jobs(self) -> dict:
        return {"jobs": self.job_store.snapshot()}

    def create_running_job(self, req: RawScrapeRequest) -> str:
        job_id = f"raw_{req.date.strftime('%Y%m%d')}_{datetime.now().strftime('%H%M%S')}"
        self.job_store.set(
            job_id,
            {
                "status": "running",
                "pipeline": "raw",
                "date": str(req.date),
                "save_to_backend": req.save_to_backend,
                "message": "Raw OCR scrape baslatildi.",
            },
        )
        return job_id

    def get_raw_output(self, target_date: date, limit: int = 20) -> dict:
        return read_raw_output_bundle(
            self.raw_output_root,
            target_date,
            limit=max(1, min(limit, 100)),
        )

    async def run_raw_scrape(self, req: RawScrapeRequest, job_id: str | None):
        try:
            await asyncio.to_thread(
                run_pipeline,
                target_date=datetime.strptime(req.date.isoformat(), "%Y-%m-%d"),
                output_dir=self.raw_output_root,
                include_main_pdf=req.include_main_pdf,
                max_docs=req.max_docs,
                ocr_cfg=OcrConfig(),
                keep_debug_images=req.keep_debug_images,
                mask_table_regions=not req.allow_table_pages,
                only_urls=req.only_urls,
                chunk_target_tokens=settings.chunk_target_tokens,
                chunk_overlap_tokens=settings.chunk_overlap_tokens,
                enable_vectorization=settings.vectorization_enabled,
                embedding_model=settings.embedding_model,
                embedding_batch_size=settings.embedding_batch_size,
                milvus_uri=settings.milvus_uri,
                milvus_token=settings.milvus_token,
                milvus_collection=settings.milvus_collection,
            )

            raw_rows = read_raw_rows(self.raw_output_root, req.date)
            scrape_result = raw_rows_to_scrape_result(req.date, raw_rows)

            saved = False
            if req.save_to_backend:
                saved = await self.backend_client.ingest_gazette(scrape_result)
                if not saved:
                    logger.warning("Raw OCR backend kaydi basarisiz.")

            bundle = read_raw_output_bundle(
                self.raw_output_root,
                req.date,
                limit=max(1, min(req.preview_limit, 100)),
            )
            summary = bundle.get("summary", {})
            docs_preview = bundle.get("documents_preview", [])

            if job_id:
                self.job_store.set(
                    job_id,
                    {
                        "status": "completed",
                        "pipeline": "raw",
                        "date": req.date.isoformat(),
                        "document_count": summary.get("documents_written", 0),
                        "table_pages_masked_total": summary.get("table_pages_masked_total", 0),
                        "table_regions_masked_total": summary.get("table_regions_masked_total", 0),
                        "saved_to_backend": saved,
                        "sample_titles": [d.get("title_hint", "")[:80] for d in docs_preview[:5]],
                        "message": (
                            "Raw OCR scrape tamamlandi."
                            + (" (backend'e kaydedildi)" if req.save_to_backend and saved else "")
                            + (" (backend'e kaydedilemedi)" if req.save_to_backend and not saved else "")
                        ),
                    },
                )

            return {
                "status": "completed",
                "pipeline": "raw",
                "date": req.date.isoformat(),
                "saved_to_backend": saved,
                "summary": summary,
                "documents_preview": docs_preview,
            }
        except Exception as exc:
            logger.exception(f"Raw scrape hatasi: {exc}")
            if job_id:
                self.job_store.set(
                    job_id,
                    {
                        "status": "error",
                        "pipeline": "raw",
                        "date": req.date.isoformat(),
                        "error": str(exc),
                    },
                )
            return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})
