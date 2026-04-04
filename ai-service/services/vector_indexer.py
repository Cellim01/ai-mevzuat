"""
AI-SERVICE-HARITA: services/vector_indexer.py
- Chunk metinlerinden embedding uretir (intfloat/multilingual-e5-large varsayilan).
- Uretilen vektorleri Milvus koleksiyonuna yazar.
- Belge bazinda ilk vektor kaydini geri donup backend'in IsVectorized alanini besler.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from typing import Any

from loguru import logger


@dataclass(frozen=True)
class VectorizationConfig:
    enabled: bool = True
    model_name: str = "intfloat/multilingual-e5-large"
    batch_size: int = 16
    milvus_uri: str = "http://localhost:19531"
    milvus_token: str = ""
    milvus_collection: str = "rg_document_chunks"


@dataclass
class VectorizationResult:
    total_chunks: int = 0
    vectorized_chunks: int = 0
    failed_chunks: int = 0
    doc_first_vector_id: dict[str, str] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


class MilvusVectorIndexer:
    def __init__(self, cfg: VectorizationConfig):
        self.cfg = cfg
        self._model = None
        self._model_lock = Lock()

    def _get_model(self):
        if self._model is not None:
            return self._model

        with self._model_lock:
            if self._model is None:
                from sentence_transformers import SentenceTransformer  # type: ignore

                self._model = SentenceTransformer(self.cfg.model_name)
        return self._model

    def index_chunks(self, chunk_rows: list[dict[str, Any]]) -> VectorizationResult:
        result = VectorizationResult(total_chunks=len(chunk_rows))
        if not self.cfg.enabled or not chunk_rows:
            return result

        try:
            from pymilvus import (  # type: ignore
                Collection,
                CollectionSchema,
                DataType,
                FieldSchema,
                connections,
                utility,
            )
        except Exception as exc:  # pragma: no cover - runtime dependency
            msg = f"pymilvus import hatasi: {exc}"
            logger.warning(msg)
            result.errors.append(msg)
            result.failed_chunks = result.total_chunks
            return result

        try:
            model = self._get_model()
            passages = [f"passage: {r.get('chunk_text', '')}" for r in chunk_rows]
            vectors = model.encode(
                passages,
                batch_size=max(1, self.cfg.batch_size),
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            vector_list = [v.tolist() if hasattr(v, "tolist") else list(v) for v in vectors]

            if not vector_list:
                result.failed_chunks = result.total_chunks
                return result

            dim = len(vector_list[0])
            connections.connect(
                alias="default",
                uri=self.cfg.milvus_uri,
                token=self.cfg.milvus_token or None,
            )

            collection_name = self.cfg.milvus_collection
            if not utility.has_collection(collection_name, using="default"):
                schema = CollectionSchema(
                    fields=[
                        FieldSchema(
                            name="id",
                            dtype=DataType.VARCHAR,
                            is_primary=True,
                            auto_id=False,
                            max_length=128,
                        ),
                        FieldSchema(name="doc_id", dtype=DataType.VARCHAR, max_length=128),
                        FieldSchema(name="chunk_index", dtype=DataType.INT64),
                        FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=1024),
                        FieldSchema(name="published_date", dtype=DataType.VARCHAR, max_length=16),
                        FieldSchema(name="source_url", dtype=DataType.VARCHAR, max_length=2048),
                        FieldSchema(name="chunk_type", dtype=DataType.VARCHAR, max_length=32),
                        FieldSchema(name="chunk_text", dtype=DataType.VARCHAR, max_length=65535),
                        FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=dim),
                    ],
                    description="Resmi Gazete belge chunk vektorlari",
                )
                collection = Collection(
                    name=collection_name,
                    schema=schema,
                    using="default",
                )
                collection.create_index(
                    field_name="embedding",
                    index_params={
                        "index_type": "HNSW",
                        "metric_type": "COSINE",
                        "params": {"M": 16, "efConstruction": 200},
                    },
                )
            else:
                collection = Collection(name=collection_name, using="default")

            collection.load()

            ids: list[str] = []
            doc_ids: list[str] = []
            chunk_indices: list[int] = []
            titles: list[str] = []
            dates: list[str] = []
            source_urls: list[str] = []
            chunk_types: list[str] = []
            chunk_texts: list[str] = []

            for row, vector in zip(chunk_rows, vector_list):
                chunk_id = self._cut(str(row.get("chunk_id", "")), 128)
                doc_id = self._cut(str(row.get("doc_id", "")), 128)
                title = self._cut(str(row.get("title", "")), 1024)
                published_date = self._cut(str(row.get("date", "")), 16)
                source_url = self._cut(str(row.get("source_url", "")), 2048)
                chunk_type = self._cut(str(row.get("chunk_type", "")), 32)
                chunk_text = self._cut(str(row.get("chunk_text", "")), 65535)

                ids.append(chunk_id)
                doc_ids.append(doc_id)
                chunk_indices.append(int(row.get("chunk_index", 0)))
                titles.append(title)
                dates.append(published_date)
                source_urls.append(source_url)
                chunk_types.append(chunk_type)
                chunk_texts.append(chunk_text)

                if doc_id and doc_id not in result.doc_first_vector_id:
                    result.doc_first_vector_id[doc_id] = chunk_id

            data = [
                ids,
                doc_ids,
                chunk_indices,
                titles,
                dates,
                source_urls,
                chunk_types,
                chunk_texts,
                vector_list,
            ]

            try:
                collection.upsert(data=data)
            except Exception:
                collection.insert(data=data)

            result.vectorized_chunks = len(chunk_rows)
            result.failed_chunks = result.total_chunks - result.vectorized_chunks
            return result
        except Exception as exc:  # pragma: no cover - runtime/system issues
            msg = f"Vector indexleme hatasi: {exc}"
            logger.exception(msg)
            result.errors.append(msg)
            result.failed_chunks = result.total_chunks
            return result
        finally:
            try:
                connections.disconnect("default")
            except Exception:
                pass

    @staticmethod
    def _cut(value: str, max_len: int) -> str:
        if len(value) <= max_len:
            return value
        return value[:max_len]
