"""
AI-SERVICE-HARITA: utils/raw_reader.py
- output/raw altindaki dosyalari okuma yardimcilarini icerir.
- documents_raw ve documents_embedding_text dosyalarini birlestirir.
- API icin ozet bundle cikartir.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def read_raw_output_bundle(raw_output_root: Path, target_date: date, limit: int = 20) -> dict[str, Any]:
    ymd = target_date.strftime("%Y%m%d")
    run_dir = raw_output_root / ymd
    summary_path = run_dir / "summary.json"
    index_path = run_dir / "index_links.json"
    docs_path = run_dir / "documents_raw.jsonl"

    if not summary_path.exists() or not docs_path.exists():
        raise FileNotFoundError(f"Raw output bulunamadi: {run_dir}")

    summary = read_json(summary_path)
    index_data = read_json(index_path) if index_path.exists() else {}

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


def read_raw_rows(raw_output_root: Path, target_date: date) -> list[dict[str, Any]]:
    ymd = target_date.strftime("%Y%m%d")
    docs_path = raw_output_root / ymd / "documents_raw.jsonl"
    emb_path = raw_output_root / ymd / "documents_embedding_text.jsonl"
    if not docs_path.exists():
        raise FileNotFoundError(f"Raw rows bulunamadi: {docs_path}")

    rows: list[dict[str, Any]] = []
    with docs_path.open("r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))

    if emb_path.exists():
        emb_by_key: dict[tuple[str, str], str] = {}
        emb_by_url: dict[str, str] = {}
        with emb_path.open("r", encoding="utf-8-sig") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                item = json.loads(line)
                source_url = str(item.get("source_url", ""))
                local_file = str(item.get("local_file", ""))
                emb_text = str(item.get("embedding_text", ""))
                if not emb_text:
                    continue
                if source_url:
                    emb_by_url[source_url] = emb_text
                if source_url and local_file:
                    emb_by_key[(source_url, local_file)] = emb_text

        for row in rows:
            source_url = str(row.get("source_url", ""))
            local_file = str(row.get("local_file", ""))
            emb_text = emb_by_key.get((source_url, local_file)) or emb_by_url.get(source_url)
            if emb_text:
                row["embedding_text"] = emb_text

    return rows
