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
    description="Resmi Gazete raw OCR pipeline servisi",
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

backend_client = BackendClient()

_jobs: dict[str, dict] = {}
_raw_output_root = Path("output/raw")


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


def _normalize_tr(text: str) -> str:
    tr_map = str.maketrans(
        {
            "\u00e7": "c",
            "\u00c7": "c",
            "\u011f": "g",
            "\u011e": "g",
            "\u0131": "i",
            "\u0130": "i",
            "\u00f6": "o",
            "\u00d6": "o",
            "\u015f": "s",
            "\u015e": "s",
            "\u00fc": "u",
            "\u00dc": "u",
            "\u00e2": "a",
            "\u00c2": "a",
            "\u00ee": "i",
            "\u00ce": "i",
            "\u00fb": "u",
            "\u00db": "u",
        }
    )
    return (text or "").translate(tr_map)


def _clean_title_hint(title: str) -> str:
    t = _collapse_ws((title or "").replace("\n", " "))
    t = re.sub(r"^[\u2013\u2014-]+\s*", "", t)
    t = re.sub(r"^[a-z\u00e7\u011f\u0131\u00f6\u015f\u00fc]\s*-\s*", "", t, flags=re.IGNORECASE)
    t = _collapse_ws(t)
    if len(t) < 4:
        return ""
    return t[:500]


def _extract_title_from_raw_text(raw_text: str) -> str:
    lines = [ln.strip() for ln in (raw_text or "").splitlines() if ln.strip()]
    skip_re = re.compile(
        r"^(?:\[\s*PAGE\s+\d+\s*\]|"
        r"\d{1,2}\s+\w+\s+\d{4}\s+\w+|"
        r"Resm[i\u00ee]\s+Gazete|"
        r"Say[\u0131i]\s*:|"
        r"Karar\s+Say[\u0131i]s[\u0131i]\s*:)\b",
        re.IGNORECASE,
    )
    generic = {
        "CUMHURBASKANI KARARI",
        "CUMHURBASKANI KARARI",
        "YONETMELIK",
        "YONETMELIK",
        "TEBLIG",
        "TEBLIG",
        "ILAN",
        "ILAN",
        "KARAR",
    }

    for ln in lines[:120]:
        line = _collapse_ws(ln)
        if not line or skip_re.search(line):
            continue
        if _normalize_tr(line).upper() in generic:
            continue
        if len(line) >= 10:
            return line[:500]
    return ""


CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Cumhurbaskanligi", ["cumhurbaskanligi kararname", "cumhurbaskanligi genelge", "cumhurbaskanligi karari"]),
    ("Bankacilik", ["merkez bankasi", "bddk", "bankacilik", "doviz kuru"]),
    ("SermayePiyasasi", ["sermaye piyasasi kurulu", "spk", "borsa istanbul", "yatirim fonu"]),
    ("FinansVergi", ["hazine ve maliye", "gelir vergisi", "kurumlar vergisi", "kdv", "muhasebat", "butce", "stopaj"]),
    ("DisTicaret", ["disisleri bakanligi", "ticaret bakanligi", "ihracat", "ithalat", "gumruk", "lisansli depo"]),
    ("AkademikIlan", ["universite", "ogretim uyesi", "docent", "profesor", "yuksekogretim", "fakulte"]),
    ("InsanKaynaklari", ["calisma ve sosyal guvenlik", "sosyal guvenlik kurumu", "is kanunu", "asgari ucret", "personel"]),
    ("Saglik", ["saglik bakanligi", "ilac", "tibbi cihaz", "eczane", "tabip", "turk gida kodeksi", "gida"]),
    ("CevreEnerji", ["cevre", "sehircilik", "enerji", "elektrik", "dogalgaz", "epdk", "iklim", "orman", "tarim ve orman"]),
    ("IhaleIlan", ["artirma", "eksiltme", "ihale", "ihale ilanlari", "belediye baskanligi", "il ozel idaresi"]),
    ("YargiCeza", ["anayasa mahkemesi", "yargitay", "danistay", "mahkeme", "savcilik", "icra mudurlugu", "yargi ilanlari"]),
]


def _detect_category(title: str, raw_text: str, source_url: str) -> str:
    text = _normalize_tr(f"{title}\n{raw_text}").lower()
    source = (source_url or "").lower()

    if "/ilanlar/eskiilanlar/" in source:
        if "yargi ilan" in text:
            return "YargiCeza"
        if "ihale" in text or "artirma" in text or "eksiltme" in text:
            return "IhaleIlan"

    best_cat = "Diger"
    best_score = 0.0
    for cat, keywords in CATEGORY_RULES:
        score = sum(1 + len(k.split()) * 0.5 for k in keywords if k in text)
        if score > best_score:
            best_score = score
            best_cat = cat
    return best_cat


def _guess_title_from_row(row: dict[str, Any], index: int) -> str:
    hint = _clean_title_hint(str(row.get("title_hint", "")))
    if hint:
        return hint

    extracted = _extract_title_from_raw_text(str(row.get("raw_text", "")))
    if extracted:
        return extracted

    source_url = _collapse_ws(str(row.get("source_url", "")))
    if source_url:
        return source_url[:500]

    return f"Belge {index}"


def _extract_issue_number(rows: list[dict[str, Any]]) -> int | None:
    issue_re = re.compile(r"Say(?:ı|i)\s*:\s*(\d{5,6})", re.IGNORECASE)
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
        source_url  = str(row.get("source_url", "")).strip()
        local_file  = row.get("local_file")
        raw_text    = str(row.get("raw_text", ""))
        title       = _guess_title_from_row(row, i)

        docs.append({
            "index":         i,
            "title":         title,
            "raw_text":      raw_text,
            "source_type":   source_type,                                    # "html" | "pdf"
            "html_url":      source_url if source_type == "html" else "",
            "pdf_url":       source_url if source_type == "pdf"  else "",
            "local_file_path": local_file,
            "category":      _detect_category(title, raw_text, source_url),
            "start_page":    0,   # rg_stage12_pipeline tek belge = 1 PDF dosyası
            "end_page":      0,   # sayfa bilgisi yok, 0 bırakıyoruz
            "table_detected": bool(row.get("table_detected", False)),
        })

    return {
        "issue_number":   _extract_issue_number(rows),
        "published_date": target_date.isoformat(),
        "documents":      docs,
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

