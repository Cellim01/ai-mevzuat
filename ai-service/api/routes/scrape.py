"""
AI-SERVICE-HARITA: api/routes/scrape.py
- /health ve /scrape/* endpointlerini barindirir.
- HTTP istek/yanit katmanidir.
- Is kurallarini ScrapeService katmanina delege eder.
"""

from __future__ import annotations

from datetime import date
from functools import partial

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.concurrency import run_in_threadpool

from api.schemas.scrape import RawScrapeRequest, VectorSearchRequest
from services.scrape_service import ScrapeService

router = APIRouter()


def _service(request: Request) -> ScrapeService:
    return request.app.state.scrape_service


def _semantic_service(request: Request):
    return request.app.state.semantic_search_service


@router.get("/health", summary="Service health")
async def health(request: Request):
    return await _service(request).health()


@router.get("/scrape/status/{job_id}", summary="Get job status")
async def scrape_status(job_id: str, request: Request):
    row = _service(request).get_job(job_id)
    if row is None:
        return JSONResponse(status_code=404, content={"error": "Job bulunamadi"})
    return row


@router.get("/scrape/jobs", summary="List jobs")
async def list_jobs(request: Request):
    return _service(request).list_jobs()


@router.post("/scrape/raw", summary="Async raw OCR scrape")
async def scrape_raw(req: RawScrapeRequest, background: BackgroundTasks, request: Request):
    service = _service(request)
    job_id = service.create_running_job(req)
    background.add_task(service.run_raw_scrape, req, job_id)
    return {
        "status": "started",
        "job_id": job_id,
        "save_to_backend": req.save_to_backend,
        "message": f"{req.date} icin raw OCR scrape baslatildi.",
    }


@router.post("/scrape/raw/sync", summary="Sync raw OCR scrape")
async def scrape_raw_sync(req: RawScrapeRequest, request: Request):
    return await _service(request).run_raw_scrape(req, job_id=None)


@router.get("/scrape/raw/output/{target_date}", summary="Get raw OCR output by date")
async def scrape_raw_output(target_date: date, request: Request, limit: int = 20):
    service = _service(request)
    try:
        return service.get_raw_output(target_date, limit=limit)
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"error": "Bu tarih icin raw output bulunamadi"})
    except Exception as exc:
        logger.exception(f"Raw output okuma hatasi: {exc}")
        return JSONResponse(status_code=500, content={"error": str(exc)})


@router.post("/search/vector", summary="Query-time semantic vector search")
async def search_vector(req: VectorSearchRequest, request: Request):
    q = (req.query or "").strip()
    if not q:
        return JSONResponse(status_code=400, content={"error": "query zorunludur"})

    max_results = max(1, min(req.max_results, 20))
    hits = await run_in_threadpool(
        partial(_semantic_service(request).search, q, max_results=max_results)
    )
    return {
        "query": q,
        "max_results": max_results,
        "count": len(hits),
        "hits": hits,
    }
