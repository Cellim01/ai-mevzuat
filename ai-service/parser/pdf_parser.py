"""
PDF Parser
──────────────────────────────────────────────────────────────
İndirilen Resmi Gazete PDF'inden metin çıkarır,
belgeleri sayfa bazlı parçalara böler.
"""

from pathlib import Path
from loguru import logger
import pdfplumber
import re


# Yeni belge başlangıcını işaret eden kalıplar
DOCUMENT_BOUNDARY_PATTERNS = [
    r"^YÖNETMELİK$",
    r"^TEBLİĞ$",
    r"^KANUN$",
    r"^KARAR$",
    r"^GENELGE$",
    r"^İLAN$",
    r"^DUYURU$",
    r"^ANAYASA MAHKEMESİ KARARI$",
    r"^CUMHURBAŞKANLIĞI KARARNAMESİ$",
]

BOUNDARY_RE = re.compile("|".join(DOCUMENT_BOUNDARY_PATTERNS), re.MULTILINE)


class PdfParser:

    def parse(self, pdf_path: Path) -> list[dict]:
        """
        PDF'i açar, her sayfadan metin çıkarır,
        belge sınırlarını tespit ederek parçalara böler.

        Dönen liste:
        [
          {
            "title": str,
            "raw_text": str,
            "start_page": int,
            "end_page": int,
          },
          ...
        ]
        """
        if not pdf_path.exists():
            logger.error(f"PDF bulunamadı: {pdf_path}")
            return []

        logger.info(f"PDF parse ediliyor: {pdf_path.name}")
        pages_text: list[str] = []

        with pdfplumber.open(pdf_path) as pdf:
            total = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                pages_text.append(text)
                if (i + 1) % 50 == 0:
                    logger.debug(f"  {i + 1}/{total} sayfa işlendi")

        logger.info(f"Toplam {total} sayfa okundu.")
        documents = self._split_into_documents(pages_text)
        logger.success(f"{len(documents)} belge tespit edildi.")
        return documents

    def _split_into_documents(self, pages: list[str]) -> list[dict]:
        """Sayfa listesini belge parçalarına böler."""
        documents: list[dict] = []
        current_doc: dict | None = None

        for page_num, text in enumerate(pages, start=1):
            lines = [l.strip() for l in text.splitlines() if l.strip()]

            for line in lines:
                if BOUNDARY_RE.match(line):
                    # Önceki belgeyi kaydet
                    if current_doc:
                        current_doc["end_page"] = page_num - 1
                        documents.append(current_doc)

                    # Yeni belge başlat — başlığı bir sonraki satır olarak al
                    current_doc = {
                        "title": line,
                        "raw_text": text,
                        "start_page": page_num,
                        "end_page": page_num,
                    }
                elif current_doc:
                    # Başlık henüz sadece tür adı ise asıl başlığı doldur
                    if current_doc["title"] in {
                        "YÖNETMELİK", "TEBLİĞ", "KANUN", "KARAR",
                        "GENELGE", "İLAN", "DUYURU"
                    }:
                        current_doc["title"] = line
                    current_doc["raw_text"] += "\n" + text
                    current_doc["end_page"] = page_num

        # Son belgeyi ekle
        if current_doc:
            documents.append(current_doc)

        # Boş raw_text olanları çıkar
        documents = [d for d in documents if len(d["raw_text"].strip()) > 100]
        return documents

    def clean_text(self, text: str) -> str:
        """Metinden gereksiz karakterleri temizler."""
        text = re.sub(r"\s{3,}", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = text.strip()
        return text
