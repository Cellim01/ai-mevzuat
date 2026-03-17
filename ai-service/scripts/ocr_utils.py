from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFilter, ImageOps


@dataclass
class OcrConfig:
    dpi: int = 450
    upscale: float = 2.0
    lang: str = "tur+eng"
    oem: int = 1
    psm: int = 6


def ensure_tesseract() -> str:
    cmd = shutil.which("tesseract")
    if cmd:
        return cmd

    env_cmd = os.getenv("TESSERACT_CMD")
    if env_cmd and Path(env_cmd).exists():
        return env_cmd

    candidates = [
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
        Path.home() / "AppData/Local/Programs/Tesseract-OCR/tesseract.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    raise RuntimeError(
        "Tesseract executable not found. Add it to PATH or set TESSERACT_CMD "
        "environment variable to full exe path."
    )


def _otsu_threshold(gray: Image.Image) -> int:
    hist = gray.histogram()
    total = gray.width * gray.height
    sum_total = sum(i * hist[i] for i in range(256))
    sum_back = 0.0
    weight_back = 0.0
    max_var = 0.0
    threshold = 127

    for t in range(256):
        weight_back += hist[t]
        if weight_back == 0:
            continue
        weight_fore = total - weight_back
        if weight_fore == 0:
            break

        sum_back += t * hist[t]
        mean_back = sum_back / weight_back
        mean_fore = (sum_total - sum_back) / weight_fore
        between = weight_back * weight_fore * (mean_back - mean_fore) ** 2

        if between > max_var:
            max_var = between
            threshold = t
    return threshold


def preprocess_for_ocr(img: Image.Image, cfg: OcrConfig) -> Image.Image:
    gray = ImageOps.grayscale(img)

    if cfg.upscale > 1.0:
        new_w = int(gray.width * cfg.upscale)
        new_h = int(gray.height * cfg.upscale)
        gray = gray.resize(
            (new_w, new_h),
            resample=Image.Resampling.BICUBIC,
        )

    denoised = gray.filter(ImageFilter.MedianFilter(size=3))
    contrasted = ImageOps.autocontrast(denoised, cutoff=1)
    thr = _otsu_threshold(contrasted)
    bw = contrasted.point(lambda p: 255 if p > thr else 0, mode="L")
    return bw


def _run_tesseract_cli(image_path: Path, tesseract_cmd: str, cfg: OcrConfig, psm: int) -> str:
    cmd = [
        tesseract_cmd,
        str(image_path),
        "stdout",
        "-l",
        cfg.lang,
        "--oem",
        str(cfg.oem),
        "--psm",
        str(psm),
        "-c",
        "preserve_interword_spaces=1",
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        check=False,
    )
    if proc.returncode != 0:
        return ""
    return proc.stdout.strip()


def _best_ocr_text(image: Image.Image, tesseract_cmd: str, cfg: OcrConfig) -> str:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        image.save(tmp_path, format="PNG")
        primary = _run_tesseract_cli(tmp_path, tesseract_cmd, cfg, psm=cfg.psm)
        if len(primary) >= 40:
            return primary
        fallback = _run_tesseract_cli(tmp_path, tesseract_cmd, cfg, psm=11)
        return fallback if len(fallback) > len(primary) else primary
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def _article_marker_count(text: str) -> int:
    upper = text.upper()
    madde = len(re.findall(r"\bMADDE\s*\d+\b", upper))
    gecici = len(re.findall(r"\bGEÇİCİ\s+MADDE\s*\d+\b", upper))
    return madde + gecici


def _should_prefer_unmasked_text(masked_text: str, unmasked_text: str) -> bool:
    if not unmasked_text.strip():
        return False
    if not masked_text.strip():
        return True

    masked_markers = _article_marker_count(masked_text)
    unmasked_markers = _article_marker_count(unmasked_text)
    if unmasked_markers > masked_markers:
        return True

    um = unmasked_text.upper()
    mm = masked_text.upper()
    if "MADDE 1" in um and "MADDE 1" not in mm:
        return True

    # If masked extraction lost substantial text, prefer unmasked then clean table rows textually.
    if len(unmasked_text) > int(len(masked_text) * 1.25):
        return True

    return False


def _hits_to_bands(hits: list[bool], min_len: int = 1, merge_gap: int = 2) -> list[tuple[int, int]]:
    bands: list[list[int]] = []
    start = None
    prev = None
    for i, flag in enumerate(hits):
        if flag:
            if start is None:
                start = i
            prev = i
        elif start is not None and prev is not None:
            if (prev - start + 1) >= min_len:
                bands.append([start, prev])
            start, prev = None, None

    if start is not None and prev is not None and (prev - start + 1) >= min_len:
        bands.append([start, prev])

    if not bands:
        return []

    merged: list[list[int]] = [bands[0]]
    for s, e in bands[1:]:
        if s - merged[-1][1] - 1 <= merge_gap:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged]


def _has_long_black_run_1d(values: list[int], min_run: int, max_white_gap: int = 2) -> bool:
    """
    Returns True if there is a long-enough black run while allowing tiny white gaps
    (common in anti-aliased/scanned table borders).
    values: 0 for black, 1 for white
    """
    run = 0
    gap = 0
    in_run = False

    for v in values:
        if v == 0:
            if in_run:
                run += 1 + gap
            else:
                in_run = True
                run = 1
            gap = 0
            if run >= min_run:
                return True
        else:
            if in_run and gap < max_white_gap:
                gap += 1
            else:
                in_run = False
                run = 0
                gap = 0
    return False


def _find_table_regions_by_runs(binary_img: Image.Image) -> list[tuple[int, int, int, int]]:
    bw = binary_img.convert("1")
    w, h = bw.size
    px = bw.load()

    # More permissive threshold to catch thinner or partially broken table lines.
    min_h_run = max(100, int(w * 0.35))
    row_hits = [False] * h
    for y in range(h):
        row_values = [px[x, y] for x in range(w)]
        row_hits[y] = _has_long_black_run_1d(row_values, min_h_run, max_white_gap=2)

    row_bands = _hits_to_bands(row_hits, min_len=1, merge_gap=2)
    if len(row_bands) < 4:
        return []

    # Allow larger gaps between horizontal borders so wide table rows are still grouped.
    block_gap = max(30, int(h * 0.10))
    grouped_blocks: list[list[tuple[int, int]]] = []
    current: list[tuple[int, int]] = []
    for band in row_bands:
        if not current:
            current = [band]
            continue
        if band[0] - current[-1][1] <= block_gap:
            current.append(band)
        else:
            grouped_blocks.append(current)
            current = [band]
    if current:
        grouped_blocks.append(current)

    regions: list[tuple[int, int, int, int]] = []
    for block in grouped_blocks:
        if len(block) < 4:
            continue
        y0 = block[0][0]
        y1 = block[-1][1]
        block_h = y1 - y0 + 1
        if block_h < max(120, int(h * 0.08)):
            continue

        min_v_run = max(60, int(block_h * 0.45))
        col_hits = [False] * w
        for x in range(w):
            col_values = [px[x, y] for y in range(y0, y1 + 1)]
            col_hits[x] = _has_long_black_run_1d(col_values, min_v_run, max_white_gap=2)

        col_bands = _hits_to_bands(col_hits, min_len=1, merge_gap=3)
        if len(col_bands) < 3:
            continue
        x0 = col_bands[0][0]
        x1 = col_bands[-1][1]
        if (x1 - x0 + 1) < int(w * 0.20):
            continue

        pad_x = max(8, int(w * 0.01))
        pad_y = max(8, int(h * 0.01))
        regions.append(
            (
                max(0, x0 - pad_x),
                max(0, y0 - pad_y),
                min(w - 1, x1 + pad_x),
                min(h - 1, y1 + pad_y),
            )
        )

    if not regions:
        return []

    regions.sort(key=lambda r: (r[1], r[0]))
    merged: list[list[int]] = [[*regions[0]]]
    for x0, y0, x1, y1 in regions[1:]:
        mx0, my0, mx1, my1 = merged[-1]
        overlap_x = not (x1 < mx0 or x0 > mx1)
        close_y = y0 <= my1 + max(10, int(h * 0.01))
        if overlap_x and close_y:
            merged[-1] = [min(mx0, x0), min(my0, y0), max(mx1, x1), max(my1, y1)]
        else:
            merged.append([x0, y0, x1, y1])

    return [(x0, y0, x1, y1) for x0, y0, x1, y1 in merged]


def _find_table_regions_by_density(binary_img: Image.Image) -> list[tuple[int, int, int, int]]:
    """
    Fallback detector for cases where grid lines are not fully continuous.
    Uses dark-pixel density instead of strict long-run continuity.
    """
    bw = binary_img.convert("1")
    w, h = bw.size
    px = bw.load()

    row_hits = [False] * h
    for y in range(h):
        dark = 0
        for x in range(w):
            if px[x, y] == 0:
                dark += 1
        if dark >= int(w * 0.40):
            row_hits[y] = True

    row_bands = _hits_to_bands(row_hits, min_len=1, merge_gap=3)
    if len(row_bands) < 4:
        return []

    block_gap = max(30, int(h * 0.10))
    grouped_blocks: list[list[tuple[int, int]]] = []
    current: list[tuple[int, int]] = []
    for band in row_bands:
        if not current:
            current = [band]
            continue
        if band[0] - current[-1][1] <= block_gap:
            current.append(band)
        else:
            grouped_blocks.append(current)
            current = [band]
    if current:
        grouped_blocks.append(current)

    regions: list[tuple[int, int, int, int]] = []
    for block in grouped_blocks:
        if len(block) < 4:
            continue
        y0 = block[0][0]
        y1 = block[-1][1]
        block_h = y1 - y0 + 1
        if block_h < max(100, int(h * 0.07)):
            continue

        col_hits = [False] * w
        for x in range(w):
            dark = 0
            for y in range(y0, y1 + 1):
                if px[x, y] == 0:
                    dark += 1
            if dark >= int(block_h * 0.42):
                col_hits[x] = True

        col_bands = _hits_to_bands(col_hits, min_len=1, merge_gap=4)
        if len(col_bands) < 3:
            continue
        x0 = col_bands[0][0]
        x1 = col_bands[-1][1]
        if (x1 - x0 + 1) < int(w * 0.18):
            continue

        pad_x = max(8, int(w * 0.01))
        pad_y = max(8, int(h * 0.01))
        regions.append(
            (
                max(0, x0 - pad_x),
                max(0, y0 - pad_y),
                min(w - 1, x1 + pad_x),
                min(h - 1, y1 + pad_y),
            )
        )

    return regions


def _merge_regions(regions: list[tuple[int, int, int, int]], h: int) -> list[tuple[int, int, int, int]]:
    if not regions:
        return []
    regions = sorted(regions, key=lambda r: (r[1], r[0]))
    merged: list[list[int]] = [[*regions[0]]]
    for x0, y0, x1, y1 in regions[1:]:
        mx0, my0, mx1, my1 = merged[-1]
        overlap_x = not (x1 < mx0 or x0 > mx1)
        close_y = y0 <= my1 + max(10, int(h * 0.01))
        if overlap_x and close_y:
            merged[-1] = [min(mx0, x0), min(my0, y0), max(mx1, x1), max(my1, y1)]
        else:
            merged.append([x0, y0, x1, y1])
    return [(x0, y0, x1, y1) for x0, y0, x1, y1 in merged]


def _find_table_regions(binary_img: Image.Image) -> list[tuple[int, int, int, int]]:
    run_regions = _find_table_regions_by_runs(binary_img)
    density_regions = _find_table_regions_by_density(binary_img)
    _, h = binary_img.size
    all_regions = run_regions + density_regions
    if not all_regions:
        return []
    return _merge_regions(all_regions, h)


def _mask_table_regions(binary_img: Image.Image) -> tuple[Image.Image, list[tuple[int, int, int, int]]]:
    regions = _find_table_regions(binary_img)
    if not regions:
        return binary_img, []
    masked = binary_img.copy()
    draw = ImageDraw.Draw(masked)
    for x0, y0, x1, y1 in regions:
        draw.rectangle((x0, y0, x1, y1), fill=255)
    return masked, regions


def _looks_like_graphics_noise(text: str) -> bool:
    """
    Heuristic for map/diagram pages that produce OCR gibberish.
    """
    if not text:
        return True
    stripped = text.strip()
    if len(stripped) < 50:
        return True

    letters = sum(ch.isalpha() for ch in stripped)
    digits = sum(ch.isdigit() for ch in stripped)
    spaces = sum(ch.isspace() for ch in stripped)
    others = max(0, len(stripped) - letters - digits - spaces)
    non_space = max(1, len(stripped) - spaces)
    other_ratio = others / non_space

    # Many symbols and very few long words is a strong sign of map OCR noise.
    tokens = [t for t in stripped.split() if t]
    long_words = sum(1 for t in tokens if len(t) >= 5)
    if other_ratio > 0.25 and long_words < 8:
        return True
    letter_ratio = letters / max(1, non_space)
    if letter_ratio < 0.55:
        return True

    # Map/diagram OCR usually lacks natural Turkish connective words.
    low = stripped.lower()
    common_tr = (
        " ve ", " ile ", " için ", " olarak ", " karar ", " madd", " tarih", " hakkında ",
        " kanun ", " cumhurbaşkanı", " bakanlık"
    )
    tr_hits = sum(low.count(tok) for tok in common_tr)
    if len(stripped) > 250 and tr_hits < 2 and other_ratio > 0.15:
        return True

    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    if len(lines) <= 2 and tr_hits == 0:
        if max((len(ln) for ln in lines), default=0) >= 180:
            return True

    if len(lines) >= 3:
        noisy = 0
        for ln in lines:
            letters_ln = sum(ch.isalpha() for ch in ln)
            digits_ln = sum(ch.isdigit() for ch in ln)
            spaces_ln = sum(ch.isspace() for ch in ln)
            others_ln = max(0, len(ln) - letters_ln - digits_ln - spaces_ln)
            non_space_ln = max(1, len(ln) - spaces_ln)
            other_ratio_ln = others_ln / non_space_ln
            if letters_ln < 6 or other_ratio_ln > 0.22:
                noisy += 1
        if (noisy / len(lines)) >= 0.60 and tr_hits < 3:
            return True
    return False


def _is_upper_heavy(line: str) -> bool:
    letters = [ch for ch in line if ch.isalpha()]
    if len(letters) < 5:
        return False
    upp = sum(1 for ch in letters if ch.isupper())
    return upp / max(1, len(letters)) >= 0.65


def _table_line_score(line: str) -> int:
    s = line.strip()
    if not s:
        return 0

    score = 0
    low = s.lower()

    if "|" in s or "¦" in s:
        score += 2
    if len(re.findall(r"\d+", s)) >= 2:
        score += 1
    if re.search(r"\s{2,}", s):
        score += 1

    kws = (
        "sira", "no", "adı", "adi", "tarih", "imza", "yeri",
        "uzunluğu", "uzunlugu", "km", "proje", "il", "ek-"
    )
    kw_hits = sum(1 for k in kws if k in low)
    if kw_hits >= 2:
        score += 2

    if _is_upper_heavy(s) and len(s) < 90:
        score += 1

    return score


def _strip_table_blocks_from_text(text: str) -> tuple[str, int]:
    """
    Textual fallback when visual table region detection misses:
    detect contiguous table-like line blocks and drop them.
    """
    lines = text.splitlines()
    n = len(lines)
    if n == 0:
        return text, 0

    marks = [False] * n
    strong_header_idx = None
    for i, ln in enumerate(lines):
        score = _table_line_score(ln)
        if score >= 2:
            marks[i] = True
        low = ln.lower()
        kw_hits = sum(1 for k in ("sira", "no", "adı", "adi", "tarih", "proje", "uzunluğu", "uzunlugu", "km") if k in low)
        if strong_header_idx is None and kw_hits >= 3 and score >= 3:
            strong_header_idx = i

    # Expand with tiny gaps so fragmented OCR table rows stay grouped.
    for i in range(1, n - 1):
        if not marks[i] and marks[i - 1] and marks[i + 1]:
            marks[i] = True

    blocks: list[tuple[int, int]] = []
    i = 0
    while i < n:
        if not marks[i]:
            i += 1
            continue
        s = i
        while i < n and marks[i]:
            i += 1
        e = i - 1
        if (e - s + 1) >= 3:
            blocks.append((s, e))

    if not blocks:
        # Tiny OCR outputs (1-2 lines) can still be table/map debris.
        if n <= 2 and any(_table_line_score(ln) >= 3 for ln in lines):
            return "", 1
        # Header-like start found but fragmented rows were not grouped.
        # In that case, remove everything after the header to avoid table leakage.
        if strong_header_idx is not None:
            cleaned = "\n".join(lines[:strong_header_idx]).strip()
            return cleaned, 1
        return text, 0

    # If a strong header exists inside/near first block, table usually continues to page end.
    if strong_header_idx is not None:
        cleaned = "\n".join(lines[:strong_header_idx]).strip()
        return cleaned, max(1, len(blocks))

    keep = [True] * n
    for s, e in blocks:
        for j in range(max(0, s - 1), min(n, e + 2)):
            keep[j] = False

    cleaned_lines = [ln for idx, ln in enumerate(lines) if keep[idx]]
    cleaned = "\n".join(cleaned_lines).strip()
    return cleaned, len(blocks)


def _line_metrics(line: str) -> tuple[int, int, int, int, float, float]:
    letters = sum(ch.isalpha() for ch in line)
    digits = sum(ch.isdigit() for ch in line)
    spaces = sum(ch.isspace() for ch in line)
    others = max(0, len(line) - letters - digits - spaces)
    non_space = max(1, len(line) - spaces)
    letter_ratio = letters / non_space
    other_ratio = others / non_space
    return letters, digits, spaces, others, letter_ratio, other_ratio


def _clean_non_prose_lines(text: str) -> tuple[str, int]:
    """
    Generic cleanup for map/figure/table residue after OCR.
    Keeps sentence-like legal prose, drops coordinate/legend/noise lines.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return "", 0

    kept: list[str] = []
    removed = 0

    coord_re = re.compile(r"\b\d{1,2}\s*[°º]\s*\d{1,2}")
    scale_re = re.compile(r"\b1\s*/\s*\d{3,6}\b")
    pipey_re = re.compile(r"[|¦]{1,}")

    for ln in lines:
        tokens = [t for t in ln.split() if t]
        letters, digits, _spaces, _others, letter_ratio, other_ratio = _line_metrics(ln)

        # Typical map/legend/shape noise signatures.
        if coord_re.search(ln):
            removed += 1
            continue
        if scale_re.search(ln):
            removed += 1
            continue
        if pipey_re.search(ln):
            removed += 1
            continue
        if letters < 6:
            removed += 1
            continue
        if other_ratio > 0.20:
            removed += 1
            continue
        if len(tokens) <= 3 and _is_upper_heavy(ln):
            removed += 1
            continue
        if digits > letters and len(tokens) < 8:
            removed += 1
            continue

        kept.append(ln)

    if not kept:
        return "", removed

    good_prose_lines = 0
    upper_heavy_lines = 0
    total_letters = 0
    total_lower = 0
    sentence_marks = 0

    for ln in kept:
        tokens = [t for t in ln.split() if t]
        letters, _digits, _spaces, _others, letter_ratio, other_ratio = _line_metrics(ln)
        total_letters += letters
        total_lower += sum(ch.islower() for ch in ln if ch.isalpha())
        sentence_marks += sum(1 for ch in ln if ch in ".;:!?")
        if _is_upper_heavy(ln):
            upper_heavy_lines += 1
        if len(tokens) >= 6 and letters >= 25 and letter_ratio >= 0.72 and other_ratio <= 0.12:
            good_prose_lines += 1

    cleaned = "\n".join(kept).strip()

    # If no sentence-like prose remained, treat as non-textual page residue.
    if good_prose_lines == 0 and len(cleaned) < 260:
        return "", removed + len(kept)

    lower_ratio = (total_lower / max(1, total_letters)) if total_letters else 0.0
    upper_heavy_ratio = upper_heavy_lines / max(1, len(kept))
    low_clean = cleaned.lower()
    has_legend_keywords = any(
        kw in low_clean
        for kw in (
            "guzergah", "güzergah",
            "acele kamulastirma", "acele kamulaştırma",
            "ilce sinir", "ilçe sınır",
            "mevcut boru", "proje sonu",
            "tesis edilecek", "enerji nakil hatti", "enerji nakil hatti", "enh",
            "datum", "d.n.", "d n", "mah :", "ilce :", "ilçe :",
            "kamulastirma yapilacak", "kamulaştırma yapılacak"
        )
    )

    # Legend/map pages are usually uppercase-heavy and weak on natural prose flow.
    if upper_heavy_ratio >= 0.60 and lower_ratio <= 0.45 and good_prose_lines <= 1:
        return "", removed + len(kept)
    if has_legend_keywords and good_prose_lines <= 1 and sentence_marks <= 2:
        return "", removed + len(kept)
    if has_legend_keywords and good_prose_lines <= 1 and len(kept) <= 8:
        return "", removed + len(kept)

    if has_legend_keywords:
        legal_signals = sum(
            low_clean.count(tok)
            for tok in (
                "gereğince", "geregince", "hakkında", "hakkinda", "karar sayısı", "karar sayisi",
                "maddesi", "verilmiştir", "verilmistir", "yürürlüğe", "yururluge",
                "suretiyle", "kamulaştırılmasına", "kamulastirilmasina"
            )
        )
        if legal_signals < 2:
            return "", removed + len(kept)

    strong_prose_signals = sum(
        low_clean.count(tok)
        for tok in (
            "gereğince", "geregince", "hakkında", "hakkinda", "maddesi",
            "tarafından", "tarafindan", "suretiyle", "karar verilmiştir", "karar verilmistir",
            "kanununun", "cumhurbaşkanı kararı", "cumhurbaskani karari"
        )
    )
    soft_prose_signals = sum(low_clean.count(tok) for tok in (" ile ", " ve ", " için ", " icin "))
    if strong_prose_signals == 0 and soft_prose_signals < 2 and sentence_marks <= 3 and len(kept) <= 8:
        return "", removed + len(kept)

    is_technical_legend = bool(
        re.search(
            r"\b(\d+\s*k[vw]|enh|datum|d\.?\s*n\.?|enerji\s+nakil\s+hatt[ıi]|g[üu]zergah)\b",
            cleaned,
            flags=re.IGNORECASE,
        )
    )
    if is_technical_legend and strong_prose_signals == 0 and good_prose_lines <= 1:
        return "", removed + len(kept)

    if has_legend_keywords and strong_prose_signals <= 1 and good_prose_lines <= 1 and len(kept) <= 12:
        return "", removed + len(kept)

    return cleaned, removed


def ocr_pdf_file(
    pdf_path: Path,
    cfg: OcrConfig,
    debug_dir: Path | None = None,
    mask_table_regions: bool = True,
) -> tuple[str, bool, int, int]:
    tesseract_cmd = ensure_tesseract()

    pdf = pdfium.PdfDocument(str(pdf_path))
    page_count = len(pdf)
    if page_count == 0:
        return "", False, 0, 0

    texts: list[str] = []
    render_scale = cfg.dpi / 72.0
    table_detected = False
    table_pages_masked = 0
    table_regions_masked = 0

    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)

    for page_index in range(page_count):
        page = pdf[page_index]
        pil_img = page.render(scale=render_scale).to_pil()
        processed = preprocess_for_ocr(pil_img, cfg)
        ocr_ready = processed

        regions: list[tuple[int, int, int, int]] = []
        if mask_table_regions:
            ocr_ready, regions = _mask_table_regions(processed)
            if regions:
                table_detected = True
                table_pages_masked += 1
                table_regions_masked += len(regions)

        if debug_dir is not None:
            out_file = debug_dir / f"{pdf_path.stem}_p{page_index + 1:04d}.png"
            ocr_ready.save(out_file, format="PNG")

        text = _best_ocr_text(ocr_ready, tesseract_cmd, cfg)
        if mask_table_regions and regions:
            unmasked_text = _best_ocr_text(processed, tesseract_cmd, cfg)
            if _should_prefer_unmasked_text(text, unmasked_text):
                text = unmasked_text

        if _looks_like_graphics_noise(text):
            continue
        if mask_table_regions:
            cleaned_text, removed_blocks = _strip_table_blocks_from_text(text)
            if removed_blocks > 0:
                table_detected = True
                table_pages_masked += 1
                table_regions_masked += removed_blocks
                text = cleaned_text
            if _looks_like_graphics_noise(text):
                continue
            text, removed_lines = _clean_non_prose_lines(text)
            if removed_lines > 0:
                table_detected = True
            if _looks_like_graphics_noise(text):
                continue
        if not text:
            continue
        texts.append(f"[PAGE {page_index + 1}]\n{text}")

    return "\n\n".join(texts).strip(), table_detected, table_pages_masked, table_regions_masked
