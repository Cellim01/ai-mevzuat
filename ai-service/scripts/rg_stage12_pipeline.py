from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Comment

try:
    from scripts.ocr_utils import OcrConfig, ocr_pdf_file
except ImportError:
    from ocr_utils import OcrConfig, ocr_pdf_file


BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
}


@dataclass
class SourceDoc:
    title_hint: str
    source_url: str
    source_type: str


def decode_content(raw: bytes) -> str:
    for enc in ("windows-1254", "iso-8859-9", "utf-8", "latin-1"):
        try:
            txt = raw.decode(enc)
            if "resm" in txt.lower() or "gazete" in txt.lower():
                return txt
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="ignore")


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def clean_html_text(html_text: str) -> str:
    soup = BeautifulSoup(html_text, "lxml")
    for tag in soup(["script", "style", "nav", "header", "footer", "meta", "link"]):
        tag.decompose()
    for c in soup.find_all(string=lambda t: isinstance(t, Comment)):
        c.extract()
    raw = soup.get_text("\n")
    return normalize_text(raw)


def build_index_url(target_date: datetime) -> str:
    y = target_date.strftime("%Y")
    m = target_date.strftime("%m")
    ds = target_date.strftime("%Y%m%d")
    return f"https://www.resmigazete.gov.tr/eskiler/{y}/{m}/{ds}.htm"


def _normalize_href(index_url: str, href: str) -> tuple[str | None, str | None]:
    href = href.strip()
    if not href:
        return None, None

    if "main.aspx" in href.lower():
        parsed = urlparse(href)
        qs = parse_qs(parsed.query)
        nested = qs.get("main", [None])[0]
        if nested:
            href = nested

    if href.lower().endswith(".pdf"):
        return urljoin(index_url, href), "pdf"
    if href.lower().endswith(".htm") or href.lower().endswith(".html"):
        return urljoin(index_url, href), "html"

    return None, None


def _infer_source_type_from_url(url: str) -> str | None:
    low = url.lower()
    if low.endswith(".pdf"):
        return "pdf"
    if low.endswith(".htm") or low.endswith(".html"):
        return "html"
    return None


def collect_source_links(index_url: str, index_html: str, date_token: str, include_main_pdf: bool) -> list[SourceDoc]:
    soup = BeautifulSoup(index_html, "lxml")
    out: list[SourceDoc] = []
    seen: set[str] = set()

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if date_token not in href:
            continue

        source_url, source_type = _normalize_href(index_url, href)
        if not source_url or not source_type:
            continue
        if source_url in seen:
            continue

        if not include_main_pdf and source_url.lower().endswith(f"/{date_token}.pdf"):
            continue

        seen.add(source_url)
        title_hint = normalize_text(a.get_text(" ", strip=True))
        out.append(SourceDoc(title_hint=title_hint, source_url=source_url, source_type=source_type))

    return out


def safe_filename(url: str) -> str:
    parsed = urlparse(url)
    base = Path(parsed.path).name or "doc"
    ext = Path(base).suffix.lower()
    if ext not in {".pdf", ".htm", ".html"}:
        ext = ".bin"
    name = Path(base).stem
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]
    return f"{name}_{digest}{ext}"


def fetch_bytes(client: httpx.Client, url: str, referrer: str | None = None) -> bytes:
    headers = {}
    if referrer:
        headers["Referer"] = referrer
    resp = client.get(url, headers=headers)
    resp.raise_for_status()
    return resp.content


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8-sig")


def write_jsonl(path: Path, rows: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def run_pipeline(
    target_date: datetime,
    output_dir: Path,
    include_main_pdf: bool,
    max_docs: int,
    ocr_cfg: OcrConfig,
    keep_debug_images: bool,
    mask_table_regions: bool,
    only_urls: list[str] | None,
) -> None:
    ymd = target_date.strftime("%Y%m%d")
    run_root = output_dir / ymd
    files_dir = run_root / "files"
    debug_img_dir = run_root / "debug_ocr_pages"
    files_dir.mkdir(parents=True, exist_ok=True)

    index_url = build_index_url(target_date)
    print(f"[1/3] Fetching index: {index_url}")

    with httpx.Client(
        timeout=45.0,
        follow_redirects=True,
        headers=BROWSER_HEADERS,
    ) as client:
        index_raw = fetch_bytes(client, index_url)
        index_html = decode_content(index_raw)
        links = collect_source_links(index_url, index_html, ymd, include_main_pdf)
        if only_urls:
            normalized_wanted: list[str] = []
            for u in only_urls:
                if not u or not u.strip():
                    continue
                normalized_wanted.append(urljoin(index_url, u.strip()))

            existing = {d.source_url: d for d in links}
            selected: list[SourceDoc] = []
            seen: set[str] = set()
            for wurl in normalized_wanted:
                if wurl in seen:
                    continue
                seen.add(wurl)

                if wurl in existing:
                    selected.append(existing[wurl])
                    continue

                stype = _infer_source_type_from_url(wurl)
                if stype:
                    selected.append(SourceDoc(title_hint="", source_url=wurl, source_type=stype))

            links = selected
        if max_docs > 0:
            links = links[:max_docs]

        write_json(
            run_root / "index_links.json",
            {
                "date": target_date.strftime("%Y-%m-%d"),
                "index_url": index_url,
                "source_count": len(links),
                "sources": [asdict(d) for d in links],
            },
        )
        print(f"[2/3] Download + extract for {len(links)} sources")

        rows: list[dict] = []
        docs_with_table_pages = 0
        table_pages_masked_total = 0
        table_regions_masked_total = 0
        for i, src in enumerate(links, start=1):
            print(f"  - ({i}/{len(links)}) {src.source_type.upper()} {src.source_url}")
            blob = fetch_bytes(client, src.source_url, referrer=index_url)
            local_name = safe_filename(src.source_url)
            local_path = files_dir / local_name
            local_path.write_bytes(blob)

            extraction_method = ""
            raw_text = ""
            if src.source_type == "html":
                html_text = decode_content(blob)
                raw_text = clean_html_text(html_text)
                extraction_method = "html_text"
                table_detected = False
                table_pages_masked = 0
                table_regions_masked = 0
            else:
                debug_dir = debug_img_dir if keep_debug_images else None
                raw_text, table_detected, table_pages_masked, table_regions_masked = ocr_pdf_file(
                    local_path,
                    ocr_cfg,
                    debug_dir=debug_dir,
                    mask_table_regions=mask_table_regions,
                )
                raw_text = normalize_text(raw_text)
                extraction_method = "pdf_ocr"
                if table_detected:
                    docs_with_table_pages += 1
                if table_pages_masked > 0:
                    table_pages_masked_total += table_pages_masked
                    table_regions_masked_total += table_regions_masked
                    print(
                        f"    -> table regions masked: {table_regions_masked} "
                        f"(pages: {table_pages_masked})"
                    )

            rows.append(
                {
                    "date": target_date.strftime("%Y-%m-%d"),
                    "title_hint": src.title_hint,
                    "source_type": src.source_type,
                    "source_url": src.source_url,
                    "local_file": str(local_path.as_posix()),
                    "extraction_method": extraction_method,
                    "table_detected": table_detected,
                    "table_pages_masked": table_pages_masked,
                    "table_regions_masked": table_regions_masked,
                    "char_count": len(raw_text),
                    "raw_text": raw_text,
                }
            )

    print("[3/3] Writing raw outputs")
    write_jsonl(run_root / "documents_raw.jsonl", rows)
    write_json(
        run_root / "summary.json",
        {
            "date": target_date.strftime("%Y-%m-%d"),
            "index_url": index_url,
            "documents_written": len(rows),
            "docs_with_table_pages": docs_with_table_pages,
            "table_pages_masked_total": table_pages_masked_total,
            "table_regions_masked_total": table_regions_masked_total,
            "output_jsonl": str((run_root / "documents_raw.jsonl").as_posix()),
            "notes": [
                "This pipeline intentionally stops before title/category normalization (step 3).",
                "PDF sources are OCRed directly with high-contrast preprocessing.",
                "Table-like regions are masked before OCR so non-table content on the same page is preserved.",
            ],
        },
    )
    print(f"Done. Output folder: {run_root}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Resmi Gazete step-1/2 pipeline: index link collection + direct OCR extraction for PDFs."
        )
    )
    parser.add_argument("--date", required=True, help="Target date in YYYY-MM-DD format.")
    parser.add_argument("--output-dir", default="output/raw", help="Folder for outputs.")
    parser.add_argument("--include-main-pdf", action="store_true", help="Include the full issue PDF.")
    parser.add_argument(
        "--only-url",
        action="append",
        default=[],
        help="Process only this source URL (can be repeated). Relative links are resolved against index URL.",
    )
    parser.add_argument("--max-docs", type=int, default=0, help="Limit source count (0 = all).")
    parser.add_argument("--dpi", type=int, default=450, help="PDF render DPI before OCR.")
    parser.add_argument("--upscale", type=float, default=2.0, help="Extra upscale ratio before OCR.")
    parser.add_argument("--ocr-lang", default="tur+eng", help="Tesseract language pack selection.")
    parser.add_argument(
        "--allow-table-pages",
        action="store_true",
        help="Do not mask table-like regions in PDFs (default behavior is to mask).",
    )
    parser.add_argument(
        "--keep-debug-images",
        action="store_true",
        help="Store preprocessed black-white page images under debug_ocr_pages.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    date_obj = datetime.strptime(args.date, "%Y-%m-%d")
    cfg = OcrConfig(dpi=args.dpi, upscale=args.upscale, lang=args.ocr_lang)
    run_pipeline(
        target_date=date_obj,
        output_dir=Path(args.output_dir),
        include_main_pdf=args.include_main_pdf,
        max_docs=args.max_docs,
        ocr_cfg=cfg,
        keep_debug_images=args.keep_debug_images,
        mask_table_regions=not args.allow_table_pages,
        only_urls=args.only_url or None,
    )
