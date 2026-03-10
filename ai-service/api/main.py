import sys
import os
from datetime import date

from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from scraper.gazette_scraper import GazetteScraper
from parser.pdf_parser import PdfParser
from utils.backend_client import BackendClient

# ── Logging ───────────────────────────────────────────────────────────────────
logger.remove()
logger.add(sys.stdout, colorize=True,
           format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")
os.makedirs("logs", exist_ok=True)
logger.add("logs/ai_service.log", rotation="10 MB", retention="7 days", encoding="utf-8")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI-Mevzuat AI Service",
    description="Resmi Gazete scraper, parser ve RAG pipeline servisi",
    version="0.3.0",
)

scraper        = GazetteScraper()
parser         = PdfParser()
backend_client = BackendClient()

_jobs: dict[str, dict] = {}


# ── Schemas ───────────────────────────────────────────────────────────────────
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


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", summary="Servis sağlık kontrolü")
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
    """Arka planda çalışır, hemen job_id döner."""
    job_id = f"scrape_{req.date.strftime('%Y%m%d')}"
    _jobs[job_id] = {"status": "running", "date": str(req.date)}
    background.add_task(_run_scrape, req.date, req.save_to_backend, job_id)
    return ScrapeResponse(status="started", job_id=job_id,
                          message=f"{req.date} için scrape başlatıldı.")


@app.post("/scrape/today", response_model=ScrapeResponse, summary="Bugünü async scrape et")
async def scrape_today(background: BackgroundTasks, save_to_backend: bool = True):
    today = date.today()
    job_id = f"scrape_{today.strftime('%Y%m%d')}"
    _jobs[job_id] = {"status": "running", "date": str(today)}
    background.add_task(_run_scrape, today, save_to_backend, job_id)
    return ScrapeResponse(status="started", job_id=job_id,
                          message=f"Bugün ({today}) için scrape başlatıldı.")


@app.post("/scrape/sync", response_model=ScrapeResponse, summary="Senkron scrape (test)")
async def scrape_sync(req: ScrapeRequest):
    """Test için — işlem bitene kadar bekler."""
    return await _run_scrape(req.date, req.save_to_backend, job_id=None)


@app.get("/scrape/status/{job_id}", summary="İş durumunu sorgula")
async def scrape_status(job_id: str):
    if job_id not in _jobs:
        return JSONResponse(status_code=404, content={"error": "Job bulunamadı"})
    return _jobs[job_id]


@app.get("/scrape/jobs", summary="Tüm işleri listele")
async def list_jobs():
    return {"jobs": _jobs}


# ── Internal ──────────────────────────────────────────────────────────────────

async def _run_scrape(
    target_date: date,
    save_to_backend: bool,
    job_id: str | None
) -> ScrapeResponse:
    try:
        result = await scraper.scrape(target_date)

        if not result:
            msg = f"{target_date} tarihinde RG bulunamadı."
            if job_id:
                _jobs[job_id] = {"status": "failed", "message": msg}
            return ScrapeResponse(status="failed", message=msg)

        doc_count = len(result.get("documents", []))
        issue_num = result.get("issue_number")
        saved     = False

        if save_to_backend:
            saved = await backend_client.ingest_gazette(result)
            if not saved:
                logger.warning("Backend'e kayıt başarısız.")

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
            message=(f"Sayı {issue_num}: {doc_count} belge işlendi."
                     + (" (backend'e kaydedildi)" if saved else " (backend'e kaydedilemedi)")),
        )

    except Exception as e:
        logger.exception(f"Scrape hatası: {e}")
        if job_id:
            _jobs[job_id] = {"status": "error", "error": str(e)}
        return ScrapeResponse(status="error", message=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
