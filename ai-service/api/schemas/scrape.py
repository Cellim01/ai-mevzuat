"""
AI-SERVICE-HARITA: api/schemas/scrape.py
- Scrape endpointlerinde kullanilan Pydantic modellerini icerir.
- RawScrapeRequest istek sozlesmesini tanimlar.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class RawScrapeRequest(BaseModel):
    date: date
    max_docs: int = 0
    include_main_pdf: bool = False
    keep_debug_images: bool = False
    allow_table_pages: bool = False
    save_to_backend: bool = True
    only_urls: list[str] | None = None
    preview_limit: int = 20


class VectorSearchRequest(BaseModel):
    query: str
    max_results: int = 5
