import asyncio
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel

from scripts.ocr_utils import OcrConfig
from scripts.rg_stage12_pipeline import run_pipeline
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
_raw_output_root = Path("output/raw")


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


class RawScrapeRequest(BaseModel):
    date: date
    max_docs: int = 0
    include_main_pdf: bool = False
    keep_debug_images: bool = False
    allow_table_pages: bool = False
    save_to_backend: bool = True
    only_urls: list[str] | None = None
    preview_limit: int = 20


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _read_raw_output_bundle(target_date: date, limit: int = 20) -> dict[str, Any]:
    ymd = target_date.strftime("%Y%m%d")
    run_dir = _raw_output_root / ymd
    summary_path = run_dir / "summary.json"
    index_path = run_dir / "index_links.json"
    docs_path = run_dir / "documents_raw.jsonl"

    if not summary_path.exists() or not docs_path.exists():
        raise FileNotFoundError(f"Raw output bulunamadi: {run_dir}")

    summary = _read_json(summary_path)
    index_data = _read_json(index_path) if index_path.exists() else {}

    docs: list[dict[str, Any]] = []
    with docs_path.open("r", encoding="utf-8-sig") as f:
        for i, line in enumerate(f):
            if i >= limit:
                break
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            docs.append(
                {
                    "title_hint": row.get("title_hint", ""),
                    "source_type": row.get("source_type", ""),
                    "source_url": row.get("source_url", ""),
                    "char_count": row.get("char_count", 0),
                    "table_detected": row.get("table_detected", False),
                    "table_pages_masked": row.get("table_pages_masked", 0),
                    "table_regions_masked": row.get("table_regions_masked", 0),
                    "raw_text_preview": (row.get("raw_text", "")[:500]),
                }
            )

    return {
        "date": target_date.isoformat(),
        "run_dir": str(run_dir.as_posix()),
        "summary": summary,
        "source_count": index_data.get("source_count", 0),
        "documents_preview": docs,
    }


def _read_raw_rows(target_date: date) -> list[dict[str, Any]]:
    ymd = target_date.strftime("%Y%m%d")
    docs_path = _raw_output_root / ymd / "documents_raw.jsonl"
    if not docs_path.exists():
        raise FileNotFoundError(f"Raw rows bulunamadi: {docs_path}")

    rows: list[dict[str, Any]] = []
    with docs_path.open("r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _collapse_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _guess_title_from_row(row: dict[str, Any], index: int) -> str:
    hint = _collapse_ws(str(row.get("title_hint", "")))
    if hint:
        return hint[:500]

    raw_text = str(row.get("raw_text", ""))
    for line in raw_text.splitlines():
        ln = _collapse_ws(line)
        if not ln:
            continue
        if ln.startswith("[PAGE"):
            continue
        if len(ln) >= 6:
            return ln[:500]

    source_url = _collapse_ws(str(row.get("source_url", "")))
    if source_url:
        return source_url[:500]

    return f"Belge {index}"


def _extract_issue_number(rows: list[dict[str, Any]]) -> int | None:
    issue_re = re.compile(r"Say[ıi]\s*:\s*(\d{5,6})", re.IGNORECASE)
    for row in rows[:5]:
        raw_text = str(row.get("raw_text", ""))
        m = issue_re.search(raw_text)
        if not m:
            continue
        try:
            return int(m.group(1))
        except ValueError:
            continue
    return None


def _raw_rows_to_scrape_result(target_date: date, rows: list[dict[str, Any]]) -> dict[str, Any]:
    docs: list[dict[str, Any]] = []
    for i, row in enumerate(rows, start=1):
        source_type = str(row.get("source_type", "")).lower()
        source_url = str(row.get("source_url", "")).strip()
        local_file = row.get("local_file")

        docs.append(
            {
                "index": i,
                "title": _guess_title_from_row(row, i),
                "raw_text": str(row.get("raw_text", "")),
                "html_url": source_url if source_type == "html" else "",
                "pdf_url": source_url if source_type == "pdf" else "",
                "local_pdf_path": local_file if source_type == "pdf" else None,
                "category": "Diger",
            }
        )

    return {
        "issue_number": _extract_issue_number(rows),
        "published_date": target_date.isoformat(),
        "documents": docs,
    }


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


@app.post("/scrape/raw", summary="Async raw OCR scrape")
async def scrape_raw(req: RawScrapeRequest, background: BackgroundTasks):
    job_id = f"raw_{req.date.strftime('%Y%m%d')}_{datetime.now().strftime('%H%M%S')}"
    _jobs[job_id] = {
        "status": "running",
        "pipeline": "raw",
        "date": str(req.date),
        "save_to_backend": req.save_to_backend,
        "message": "Raw OCR scrape baslatildi.",
    }
    background.add_task(_run_raw_scrape, req, job_id)
    return {
        "status": "started",
        "job_id": job_id,
        "save_to_backend": req.save_to_backend,
        "message": f"{req.date} icin raw OCR scrape baslatildi.",
    }


@app.post("/scrape/raw/sync", summary="Sync raw OCR scrape")
async def scrape_raw_sync(req: RawScrapeRequest):
    return await _run_raw_scrape(req, job_id=None)


@app.get("/scrape/raw/output/{target_date}", summary="Get raw OCR output by date")
async def scrape_raw_output(target_date: date, limit: int = 20):
    try:
        return _read_raw_output_bundle(target_date, limit=max(1, min(limit, 100)))
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"error": "Bu tarih icin raw output bulunamadi"})
    except Exception as exc:
        logger.exception(f"Raw output okuma hatasi: {exc}")
        return JSONResponse(status_code=500, content={"error": str(exc)})


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


async def _run_raw_scrape(req: RawScrapeRequest, job_id: str | None):
    try:
        await asyncio.to_thread(
            run_pipeline,
            target_date=datetime.strptime(req.date.isoformat(), "%Y-%m-%d"),
            output_dir=_raw_output_root,
            include_main_pdf=req.include_main_pdf,
            max_docs=req.max_docs,
            ocr_cfg=OcrConfig(),
            keep_debug_images=req.keep_debug_images,
            mask_table_regions=not req.allow_table_pages,
            only_urls=req.only_urls,
        )

        raw_rows = _read_raw_rows(req.date)
        scrape_result = _raw_rows_to_scrape_result(req.date, raw_rows)
        saved = False
        if req.save_to_backend:
            saved = await backend_client.ingest_gazette(scrape_result)
            if not saved:
                logger.warning("Raw OCR backend kaydi basarisiz.")

        bundle = _read_raw_output_bundle(req.date, limit=max(1, min(req.preview_limit, 100)))
        summary = bundle.get("summary", {})
        docs_preview = bundle.get("documents_preview", [])

        if job_id:
            _jobs[job_id] = {
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
            }

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
            _jobs[job_id] = {
                "status": "error",
                "pipeline": "raw",
                "date": req.date.isoformat(),
                "error": str(exc),
            }
        return JSONResponse(status_code=500, content={"status": "error", "message": str(exc)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
