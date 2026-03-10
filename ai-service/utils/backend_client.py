"""
Backend Client — AI Service → .NET Backend
POST /api/gazette/ingest ile scrape sonucunu gönderir.
"""

import httpx
from loguru import logger
from utils.config import settings


class BackendClient:

    def __init__(self):
        self.base_url = settings.backend_url.rstrip("/")
        self.api_key  = settings.backend_api_key

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["X-Api-Key"] = self.api_key
        return h

    async def ingest_gazette(self, scrape_result: dict) -> bool:
        url = f"{self.base_url}/api/gazette/ingest"
        logger.info(f"Backend'e gönderiliyor → {url}")
        logger.info(f"  Sayı: {scrape_result.get('issue_number')} | "
                    f"{len(scrape_result.get('documents', []))} belge")

        async with httpx.AsyncClient(timeout=60) as client:
            try:
                resp = await client.post(url, json=scrape_result, headers=self._headers())
                resp.raise_for_status()
                data = resp.json()
                logger.success(
                    f"Backend kabul etti → "
                    f"Issue ID: {data.get('issueId')} | "
                    f"{data.get('savedDocuments')} belge kaydedildi"
                )
                return True
            except httpx.HTTPStatusError as e:
                logger.error(f"Backend HTTP {e.response.status_code}: {e.response.text}")
                return False
            except httpx.ConnectError:
                logger.error(f"Backend'e bağlanılamadı: {self.base_url}")
                return False
            except Exception as e:
                logger.error(f"Backend gönderme hatası: {e}")
                return False

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except Exception:
            return False
