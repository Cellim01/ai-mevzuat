from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageFilter, ImageOps


@dataclass
class OcrConfig:
    dpi: int = 450
    upscale: float = 2.0
    lang: str = "tur+eng"
    oem: int = 1
    psm: int = 6


def ensure_tesseract() -> None:
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


def ocr_pdf_file(pdf_path: Path, cfg: OcrConfig, debug_dir: Path | None = None) -> str:
    tesseract_cmd = ensure_tesseract()

    pdf = pdfium.PdfDocument(str(pdf_path))
    page_count = len(pdf)
    if page_count == 0:
        return ""

    texts: list[str] = []
    render_scale = cfg.dpi / 72.0

    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)

    for page_index in range(page_count):
        page = pdf[page_index]
        pil_img = page.render(scale=render_scale).to_pil()
        processed = preprocess_for_ocr(pil_img, cfg)

        if debug_dir is not None:
            out_file = debug_dir / f"{pdf_path.stem}_p{page_index + 1:04d}.png"
            processed.save(out_file, format="PNG")

        text = _best_ocr_text(processed, tesseract_cmd, cfg)
        if text:
            texts.append(f"[PAGE {page_index + 1}]\n{text}")

    return "\n\n".join(texts).strip()
