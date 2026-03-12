"""
Backend Client - AI Service -> .NET Backend
POST /api/gazette/ingest with mapped payload.
"""

import httpx
from loguru import logger

from utils.config import settings


class BackendClient:
    def __init__(self):
        self.base_url = settings.backend_url.rstrip("/")
        self.api_key = settings.backend_api_key

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-Api-Key"] = self.api_key
        return headers

    def _to_ingest_payload(self, scrape_result: dict) -> dict:
        """Map scraper snake_case payload to backend DTO shape."""
        docs = []
        for d in scrape_result.get("documents", []):
            docs.append(
                {
                    "Index": d.get("index"),
                    "Title": d.get("title", ""),
                    "RawText": d.get("raw_text", ""),
                    "HtmlUrl": d.get("html_url", ""),
                    "PdfUrl": d.get("pdf_url", ""),
                    "LocalPdfPath": d.get("local_pdf_path"),
                    "Category": d.get("category", "Diger"),
                }
            )

        return {
            "IssueNumber": scrape_result.get("issue_number"),
            "PublishedDate": scrape_result.get("published_date"),
            "Documents": docs,
        }

    async def ingest_gazette(self, scrape_result: dict) -> bool:
        url = f"{self.base_url}/api/gazette/ingest"
        payload = self._to_ingest_payload(scrape_result)

        logger.info(f"Backend'e gonderiliyor -> {url}")
        logger.info(
            f"  Sayi: {payload.get('IssueNumber')} | {len(payload.get('Documents', []))} belge"
        )

        async with httpx.AsyncClient(timeout=60) as client:
            try:
                resp = await client.post(url, json=payload, headers=self._headers())
                resp.raise_for_status()
                data = resp.json()
                logger.success(
                    f"Backend kabul etti -> Issue ID: {data.get('issueId')} | "
                    f"{data.get('savedDocuments')} belge kaydedildi"
                )
                return True
            except httpx.HTTPStatusError as e:
                logger.error(f"Backend HTTP {e.response.status_code}: {e.response.text}")
                return False
            except httpx.ConnectError:
                logger.error(f"Backend'e baglanilamadi: {self.base_url}")
                return False
            except Exception as e:
                logger.error(f"Backend gonderme hatasi: {e}")
                return False

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except Exception:
            return False
