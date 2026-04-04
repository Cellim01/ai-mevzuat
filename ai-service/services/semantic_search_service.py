"""
AI-SERVICE-HARITA: services/semantic_search_service.py
- Milvus koleksiyonunda query-time semantic arama yapar.
- Sorgu embedding'i uretir ve benzer chunk'lari bulur.
- Sonuclari belge bazinda tekilleştirip backend'in tuketecegi sade formata cevirir.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from loguru import logger


@dataclass(frozen=True)
class SemanticSearchConfig:
    enabled: bool = True
    model_name: str = "intfloat/multilingual-e5-large"
    milvus_uri: str = "http://localhost:19531"
    milvus_token: str = ""
    milvus_collection: str = "rg_document_chunks"


class MilvusSemanticSearchService:
    def __init__(self, cfg: SemanticSearchConfig):
        self.cfg = cfg

    def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        q = (query or "").strip()
        limit = max(1, min(max_results, 20))
        if not q or not self.cfg.enabled:
            return []

        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            from pymilvus import Collection, connections, utility  # type: ignore
        except Exception as exc:  # pragma: no cover - runtime dependency
            logger.warning(f"Semantic search dependency hatasi: {exc}")
            return []

        try:
            model = SentenceTransformer(self.cfg.model_name)
            query_vec = model.encode(
                [f"query: {q}"],
                show_progress_bar=False,
                normalize_embeddings=True,
            )[0]
            if hasattr(query_vec, "tolist"):
                query_vec = query_vec.tolist()

            connections.connect(
                alias="default",
                uri=self.cfg.milvus_uri,
                token=self.cfg.milvus_token or None,
            )

            if not utility.has_collection(self.cfg.milvus_collection, using="default"):
                return []

            collection = Collection(name=self.cfg.milvus_collection, using="default")
            collection.load()

            raw_hits = collection.search(
                data=[query_vec],
                anns_field="embedding",
                param={"metric_type": "COSINE", "params": {"ef": 128}},
                limit=max(limit * 3, limit),
                output_fields=[
                    "doc_id",
                    "title",
                    "source_url",
                    "chunk_text",
                    "chunk_index",
                    "chunk_type",
                    "published_date",
                ],
            )

            if not raw_hits or len(raw_hits) == 0:
                return []

            rows: list[dict[str, Any]] = []
            seen: set[str] = set()
            for hit in raw_hits[0]:
                entity = getattr(hit, "entity", None)
                if entity is None:
                    continue

                source_url = str(entity.get("source_url") or "").strip()
                doc_id = str(entity.get("doc_id") or "").strip()
                dedup_key = source_url or doc_id
                if not dedup_key or dedup_key in seen:
                    continue
                seen.add(dedup_key)

                snippet = str(entity.get("chunk_text") or "").strip()
                if len(snippet) > 900:
                    snippet = snippet[:900] + "..."

                rows.append(
                    {
                        "doc_id": doc_id,
                        "source_url": source_url,
                        "title": str(entity.get("title") or "").strip(),
                        "snippet": snippet,
                        "score": float(getattr(hit, "distance", 0.0)),
                        "chunk_index": int(entity.get("chunk_index") or 0),
                        "chunk_type": str(entity.get("chunk_type") or "").strip(),
                        "published_date": str(entity.get("published_date") or "").strip(),
                    }
                )

                if len(rows) >= limit:
                    break

            return rows
        except Exception as exc:  # pragma: no cover - runtime/system issues
            logger.warning(f"Milvus semantic search hatasi: {exc}")
            return []
        finally:
            try:
                from pymilvus import connections  # type: ignore

                connections.disconnect("default")
            except Exception:
                pass
