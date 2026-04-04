"""
AI-SERVICE-HARITA: services/chunking.py
- OCR'dan gelen belge metnini RAG icin parcalara (chunk) boler.
- Yonetmelik/teblig metinlerinde madde bazli, ilan tipinde paragraf bazli ayrim yapar.
- Hedef token ve overlap kurallarini uygular; her chunk'a belge basligi prefiksi ekler.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


MADDE_LINE_RE = re.compile(
    r"^\s*((?:GECICI|GEÇICI|GEÇİCİ)\s+)?MADDE\s+([0-9]+[A-Z]?)\s*[-–—]",
    re.IGNORECASE,
)
PAGE_MARKER_RE = re.compile(r"\[\s*PAGE\s+\d+\s*\]", re.IGNORECASE)


@dataclass(frozen=True)
class ChunkingConfig:
    target_tokens: int = 512
    overlap_tokens: int = 64


def _collapse_ws(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _normalize_body(raw_text: str) -> str:
    text = (raw_text or "").replace("\r", "\n")
    text = PAGE_MARKER_RE.sub(" ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _tokenize(text: str) -> list[str]:
    return [t for t in (text or "").split() if t]


def _window_tokens(tokens: list[str], target: int, overlap: int) -> list[list[str]]:
    if not tokens:
        return []
    if len(tokens) <= target:
        return [tokens]

    step = max(1, target - overlap)
    out: list[list[str]] = []
    start = 0
    while start < len(tokens):
        end = min(len(tokens), start + target)
        out.append(tokens[start:end])
        if end >= len(tokens):
            break
        start += step
    return out


def _split_sentence_units(text: str) -> list[str]:
    """
    Metni cumle-benzeri birimlere ayirir.
    Not: Bu semantic/LLM tabanli bir bolme degil; noktalama-temelli hafif bir yaklasimdir.
    """
    raw = re.split(r"(?<=[\.\!\?\:\;])\s+|\n+", text or "")
    units = [_collapse_ws(x) for x in raw if _collapse_ws(x)]
    return units


def _window_sentence_units(
    text: str,
    target_tokens: int,
    overlap_tokens: int,
) -> list[tuple[str, int]]:
    """
    Cumle birimlerini kullanarak token penceresi olusturur.
    Boylece chunklar mumkun oldugunca cumle ortasindan degil cumle sonundan kesilir.
    """
    units = _split_sentence_units(text)
    if not units:
        body = _collapse_ws(text)
        toks = _tokenize(body)
        return [(body, len(toks))] if body else []

    # Tek bir cumle asiri uzunsa, kontrollu sekilde token penceresine bol.
    normalized_units: list[str] = []
    fallback_overlap = max(0, overlap_tokens // 2)
    for unit in units:
        toks = _tokenize(unit)
        if len(toks) <= target_tokens:
            normalized_units.append(unit)
            continue
        for win in _window_tokens(toks, target_tokens, fallback_overlap):
            normalized_units.append(" ".join(win).strip())

    token_counts = [len(_tokenize(u)) for u in normalized_units]
    n = len(normalized_units)
    out: list[tuple[str, int]] = []

    i = 0
    while i < n:
        j = i
        total = 0
        while j < n and (total + token_counts[j] <= target_tokens or j == i):
            total += token_counts[j]
            j += 1
            if total >= target_tokens:
                break

        chunk_text = _collapse_ws(" ".join(normalized_units[i:j]))
        if chunk_text:
            out.append((chunk_text, len(_tokenize(chunk_text))))

        if j >= n:
            break

        next_i = j
        overlap_acc = 0
        while next_i > i and overlap_acc < overlap_tokens:
            next_i -= 1
            overlap_acc += token_counts[next_i]

        if next_i <= i:
            next_i = i + 1

        i = next_i

    return out


def _split_by_madde(text: str) -> list[tuple[str, str]]:
    lines = text.splitlines()
    segments: list[tuple[str, list[str]]] = []
    current_label = "GENEL"
    current_lines: list[str] = []

    for line in lines:
        raw = line.strip()
        if not raw:
            if current_lines:
                current_lines.append("")
            continue

        match = MADDE_LINE_RE.match(raw)
        if match:
            if current_lines:
                segments.append((current_label, current_lines))
            no = match.group(2)
            current_label = f"MADDE {no}"
            current_lines = [raw]
            continue

        current_lines.append(raw)

    if current_lines:
        segments.append((current_label, current_lines))

    cooked: list[tuple[str, str]] = []
    for label, part_lines in segments:
        body = _collapse_ws(" ".join(part_lines))
        if body:
            cooked.append((label, body))
    return cooked


def _split_by_paragraph(text: str) -> list[tuple[str, str]]:
    raw_parts = re.split(r"\n\s*\n+", text)
    parts = [_collapse_ws(p) for p in raw_parts if _collapse_ws(p)]
    return [("PARAGRAF", p) for p in parts]


def _is_ilan_like(title: str, rg_section: str, rg_subsection: str) -> bool:
    space = " ".join([title or "", rg_section or "", rg_subsection or ""]).upper()
    return "ILAN" in space or "İLAN" in space


def build_document_chunks(
    *,
    doc_id: str,
    title: str,
    raw_text: str,
    rg_section: str,
    rg_subsection: str,
    cfg: ChunkingConfig,
) -> list[dict]:
    body = _normalize_body(raw_text)
    if not body:
        return []

    split_mode = "paragraf"
    if not _is_ilan_like(title, rg_section, rg_subsection):
        madde_parts = _split_by_madde(body)
        if len(madde_parts) >= 2:
            split_mode = "madde"
            parts = madde_parts
        else:
            parts = _split_by_paragraph(body)
    else:
        parts = _split_by_paragraph(body)

    if not parts:
        parts = [("PARAGRAF", body)]

    chunk_rows: list[dict] = []
    chunk_index = 0
    for label, content in parts:
        windows = _window_sentence_units(
            content,
            target_tokens=cfg.target_tokens,
            overlap_tokens=cfg.overlap_tokens,
        )
        for chunk_body, token_count in windows:
            chunk_index += 1
            chunk_text = f"{title} | {label}: {chunk_body}"
            chunk_rows.append(
                {
                    "doc_id": doc_id,
                    "chunk_index": chunk_index,
                    "chunk_id": f"{doc_id}:{chunk_index:04d}",
                    "chunk_type": split_mode,
                    "chunk_label": label,
                    "token_count": token_count,
                    "chunk_text": chunk_text,
                }
            )
    return chunk_rows
