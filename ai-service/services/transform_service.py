"""
AI-SERVICE-HARITA: services/transform_service.py
- Raw OCR satirlarindan backend ingest formati uretir.
- Baslik tahmini, issue number cikarma ve temel metin temizleme yapar.
- Kategori tespiti icin classification servisini kullanir.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

from services.classification import detect_category, normalize_tr


def collapse_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def clean_title_hint(title: str) -> str:
    value = collapse_ws((title or "").replace("\n", " "))
    value = re.sub(r"^[\u2013\u2014-]+\s*", "", value)
    value = re.sub(r"^[a-z\u00e7\u011f\u0131\u00f6\u015f\u00fc]\s*-\s*", "", value, flags=re.IGNORECASE)
    value = collapse_ws(value)
    if len(value) < 4:
        return ""
    return value[:500]


def extract_title_from_raw_text(raw_text: str) -> str:
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
        "YONETMELIK",
        "TEBLIG",
        "ILAN",
        "KARAR",
    }

    for ln in lines[:120]:
        line = collapse_ws(ln)
        if not line or skip_re.search(line):
            continue
        if normalize_tr(line).upper() in generic:
            continue
        if len(line) >= 10:
            return line[:500]
    return ""


def guess_title_from_row(row: dict[str, Any], index: int) -> str:
    hint = clean_title_hint(str(row.get("title_hint", "")))
    if hint:
        return hint

    extracted = extract_title_from_raw_text(str(row.get("raw_text", "")))
    if extracted:
        return extracted

    source_url = collapse_ws(str(row.get("source_url", "")))
    if source_url:
        return source_url[:500]

    return f"Belge {index}"


def extract_issue_number(rows: list[dict[str, Any]]) -> int | None:
    issue_re = re.compile(r"Say(?:\u0131|i)\s*:\s*(\d{5,6})", re.IGNORECASE)
    for row in rows[:5]:
        raw_text = str(row.get("raw_text", ""))
        match = issue_re.search(raw_text)
        if not match:
            continue
        try:
            return int(match.group(1))
        except ValueError:
            continue
    return None


def raw_rows_to_scrape_result(target_date: date, rows: list[dict[str, Any]]) -> dict[str, Any]:
    docs: list[dict[str, Any]] = []
    for i, row in enumerate(rows, start=1):
        source_type = str(row.get("source_type", "")).lower()
        source_url = str(row.get("source_url", "")).strip()
        local_file = row.get("local_file")
        raw_text = str(row.get("raw_text", ""))
        embedding_text = str(row.get("embedding_text", "")) or raw_text
        title = guess_title_from_row(row, i)

        docs.append(
            {
                "index": i,
                "title": title,
                "raw_text": raw_text,
                "embedding_text": embedding_text,
                "source_type": source_type,
                "html_url": source_url if source_type == "html" else "",
                "pdf_url": source_url if source_type == "pdf" else "",
                "local_file_path": local_file,
                "category": detect_category(title, raw_text, source_url),
                "start_page": 0,
                "end_page": 0,
                "table_detected": bool(row.get("table_detected", False)),
                "rg_section": row.get("rg_section", "") or "",
                "rg_subsection": row.get("rg_subsection", "") or "",
            }
        )

    return {
        "issue_number": extract_issue_number(rows),
        "published_date": target_date.isoformat(),
        "documents": docs,
    }
