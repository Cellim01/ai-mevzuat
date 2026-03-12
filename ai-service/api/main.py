import os
import sys
from datetime import date

from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel

from parser.pdf_parser import PdfParser
from scraper.gazette_scraper import GazetteScraper
from utils.backend_client import BackendClient
from utils.config import settings

logger.remove()
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}",
)
os.makedirs("logs", exist_ok=True)
logger.add("logs/ai_service.log", rotation="10 MB", retention="7 days", encoding="utf-8")

app = FastAPI(
    title="AI-Mevzuat AI Service",
    description="Resmi Gazete scraper, parser ve RAG pipeline servisi",
    version="0.3.0",
)


def _parse_cors_origins(value: str) -> list[str]:
    origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
    return origins or ["http://localhost:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scraper = GazetteScraper()
parser = PdfParser()
backend_client = BackendClient()

_jobs: dict[str, dict] = {}


class ScrapeRequest(BaseModel):
    date: date
    save_to_backend: bool = True


class ScrapeResponse(BaseModel):
    status: str
    job_id: str | None = None
    issue_number: int | None = None
    document_count: int = 0
    saved_to_backend: bool = False
    message: str = ""


@app.get("/health", summary="Service health")
async def health():
    backend_ok = await backend_client.health_check()
    return {
        "status": "ok",
        "service": "ai-mevzuat-ai-service",
        "version": "0.3.0",
        "backend_reachable": backend_ok,
    }


@app.post("/scrape", response_model=ScrapeResponse, summary="Async scrape")
async def scrape_gazette(req: ScrapeRequest, background: BackgroundTasks):
    job_id = f"scrape_{req.date.strftime('%Y%m%d')}"
    _jobs[job_id] = {"status": "running", "date": str(req.date)}
    background.add_task(_run_scrape, req.date, req.save_to_backend, job_id)
    return ScrapeResponse(
        status="started",
        job_id=job_id,
        message=f"{req.date} icin scrape baslatildi.",
    )


@app.post("/scrape/today", response_model=ScrapeResponse, summary="Async scrape today")
async def scrape_today(background: BackgroundTasks, save_to_backend: bool = True):
    today = date.today()
    job_id = f"scrape_{today.strftime('%Y%m%d')}"
    _jobs[job_id] = {"status": "running", "date": str(today)}
    background.add_task(_run_scrape, today, save_to_backend, job_id)
    return ScrapeResponse(
        status="started",
        job_id=job_id,
        message=f"Bugun ({today}) icin scrape baslatildi.",
    )


@app.post("/scrape/sync", response_model=ScrapeResponse, summary="Sync scrape")
async def scrape_sync(req: ScrapeRequest):
    return await _run_scrape(req.date, req.save_to_backend, job_id=None)


@app.get("/scrape/status/{job_id}", summary="Get job status")
async def scrape_status(job_id: str):
    if job_id not in _jobs:
        return JSONResponse(status_code=404, content={"error": "Job bulunamadi"})
    return _jobs[job_id]


@app.get("/scrape/jobs", summary="List jobs")
async def list_jobs():
    return {"jobs": _jobs}


async def _run_scrape(target_date: date, save_to_backend: bool, job_id: str | None) -> ScrapeResponse:
    try:
        result = await scraper.scrape(target_date)

        if not result:
            msg = f"{target_date} tarihinde RG bulunamadi."
            if job_id:
                _jobs[job_id] = {"status": "failed", "message": msg}
            return ScrapeResponse(status="failed", message=msg)

        doc_count = len(result.get("documents", []))
        issue_num = result.get("issue_number")
        saved = False

        if save_to_backend:
            saved = await backend_client.ingest_gazette(result)
            if not saved:
                logger.warning("Backend kaydi basarisiz.")

        if job_id:
            _jobs[job_id] = {
                "status": "completed",
                "issue_number": issue_num,
                "document_count": doc_count,
                "saved_to_backend": saved,
                "date": str(target_date),
                "sample_titles": [d["title"][:80] for d in result["documents"][:5]],
            }

        return ScrapeResponse(
            status="completed",
            issue_number=issue_num,
            document_count=doc_count,
            saved_to_backend=saved,
            message=(
                f"Sayi {issue_num}: {doc_count} belge islendi."
                + (" (backend'e kaydedildi)" if saved else " (backend'e kaydedilemedi)")
            ),
        )

    except Exception as exc:
        logger.exception(f"Scrape hatasi: {exc}")
        if job_id:
            _jobs[job_id] = {"status": "error", "error": str(exc)}
        return ScrapeResponse(status="error", message=str(exc))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
