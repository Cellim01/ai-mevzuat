# Resmi Gazette Step-1/2 Scripts

This folder contains scripts for:
- Step 1: collect source links from archive index page.
- Step 2: extract raw text by direct OCR for PDFs and text parse for HTML docs.

Step 3 (normalization/classification) is intentionally not included yet.

## Prerequisites

Install Python deps:

```bash
pip install -r requirements.txt
```

Install Tesseract OCR and Turkish language data (`tur`):
- Windows: install Tesseract and add installation folder to `PATH`.
- Ensure `tesseract --version` works in terminal.
- Ensure `tur.traineddata` exists in your Tesseract `tessdata` folder.

## Run

From `ai-service/`:

```bash
python scripts/rg_stage12_pipeline.py --date 2026-03-17 --keep-debug-images
```

Useful options:

```bash
python scripts/rg_stage12_pipeline.py \
  --date 2026-03-17 \
  --dpi 500 \
  --upscale 2.2 \
  --ocr-lang tur+eng \
  --max-docs 10
```

Include the full issue PDF too:

```bash
python scripts/rg_stage12_pipeline.py --date 2026-03-17 --include-main-pdf
```

## Output

Default output root: `output/raw/YYYYMMDD/`
- `index_links.json`: collected source links.
- `documents_raw.jsonl`: extracted raw text rows.
- `summary.json`: quick run summary.
- `files/`: downloaded source files.
- `debug_ocr_pages/`: preprocessed black-white page images (if `--keep-debug-images`).
