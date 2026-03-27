"""
AI-SERVICE-HARITA: utils/job_store.py
- Job durumlarini JSON dosyasinda kalici tutar.
- set/get/snapshot operasyonlarini thread-safe sekilde saglar.
- Eski joblari max history limitine gore temizler.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Any

from loguru import logger


class JobStore:
    def __init__(self, state_file: str, max_history: int = 300):
        self._state_path = Path(state_file)
        self._max_history = max_history
        self._lock = Lock()
        self._jobs: dict[str, dict[str, Any]] = self._load_state()

    @staticmethod
    def _utc_now_iso() -> str:
        return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    def _load_state(self) -> dict[str, dict[str, Any]]:
        if not self._state_path.exists():
            return {}
        try:
            raw = json.loads(self._state_path.read_text(encoding="utf-8-sig"))
            if not isinstance(raw, dict):
                logger.warning("jobs_state.json formati gecersiz, bos job listesi ile devam ediliyor.")
                return {}
            cleaned: dict[str, dict[str, Any]] = {}
            for key, value in raw.items():
                if isinstance(key, str) and isinstance(value, dict):
                    cleaned[key] = value
            return cleaned
        except Exception as exc:
            logger.warning(f"jobs_state.json okunamadi: {exc}")
            return {}

    def _persist_locked(self) -> None:
        try:
            self._state_path.parent.mkdir(parents=True, exist_ok=True)
            self._state_path.write_text(
                json.dumps(self._jobs, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning(f"jobs_state.json yazilamadi: {exc}")

    def _trim_locked(self) -> None:
        if len(self._jobs) <= self._max_history:
            return
        ordered_ids = sorted(
            self._jobs.keys(),
            key=lambda key: str(self._jobs.get(key, {}).get("created_at", "")),
        )
        keep = set(ordered_ids[-self._max_history :])
        for job_id in list(self._jobs.keys()):
            if job_id not in keep:
                self._jobs.pop(job_id, None)

    def set(self, job_id: str, values: dict[str, Any]) -> None:
        now = self._utc_now_iso()
        with self._lock:
            current = self._jobs.get(job_id, {})
            created_at = str(current.get("created_at") or values.get("created_at") or now)
            merged = {**current, **values}
            merged["created_at"] = created_at
            merged["updated_at"] = now
            self._jobs[job_id] = merged
            self._trim_locked()
            self._persist_locked()

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._jobs.get(job_id)
            return dict(row) if isinstance(row, dict) else None

    def snapshot(self) -> dict[str, dict[str, Any]]:
        with self._lock:
            return {key: dict(value) for key, value in self._jobs.items()}
