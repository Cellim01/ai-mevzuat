from urllib.parse import urlparse

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_PLACEHOLDER_MARKERS = (
    "degistir",
    "placeholder",
    "gizli-anahtar",
    "set_via_env",
    "set-from-env",
    "changeme",
)


def _looks_like_placeholder(value: str) -> bool:
    lower = (value or "").strip().lower()
    if not lower:
        return False
    return any(marker in lower for marker in _PLACEHOLDER_MARKERS)


def _is_http_url(value: str) -> bool:
    parsed = urlparse((value or "").strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


class Settings(BaseSettings):
    # Frontend CORS origins (comma-separated)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    # .NET backend
    backend_url: str = "http://localhost:5000"
    backend_api_key: str = ""

    # Job persistence
    jobs_state_file: str = "output/jobs_state.json"

    # Chunking + vectorization
    chunk_target_tokens: int = 512
    chunk_overlap_tokens: int = 64
    vectorization_enabled: bool = True
    embedding_model: str = "intfloat/multilingual-e5-large"
    embedding_batch_size: int = 16
    milvus_uri: str = "http://localhost:19531"
    milvus_token: str = ""
    milvus_collection: str = "rg_document_chunks"

    @field_validator("chunk_target_tokens")
    @classmethod
    def _validate_chunk_target_tokens(cls, value: int) -> int:
        if value < 64:
            raise ValueError("CHUNK_TARGET_TOKENS en az 64 olmali.")
        return value

    @field_validator("chunk_overlap_tokens")
    @classmethod
    def _validate_chunk_overlap_tokens(cls, value: int) -> int:
        if value < 0:
            raise ValueError("CHUNK_OVERLAP_TOKENS negatif olamaz.")
        return value

    @field_validator("embedding_batch_size")
    @classmethod
    def _validate_embedding_batch_size(cls, value: int) -> int:
        if value < 1:
            raise ValueError("EMBEDDING_BATCH_SIZE en az 1 olmali.")
        return value

    @model_validator(mode="after")
    def _validate_runtime_settings(self) -> "Settings":
        if not _is_http_url(self.backend_url):
            raise ValueError("BACKEND_URL gecerli bir http/https URL olmali.")

        if self.backend_api_key and _looks_like_placeholder(self.backend_api_key):
            raise ValueError(
                "BACKEND_API_KEY placeholder deger olamaz. Bos birak veya gercek key gir."
            )

        if self.vectorization_enabled:
            if not self.milvus_uri.strip():
                raise ValueError("MILVUS_URI bos olamaz (vectorization acikken).")
            if not _is_http_url(self.milvus_uri):
                raise ValueError("MILVUS_URI gecerli bir http/https URL olmali.")

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
