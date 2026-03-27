"""
AI-SERVICE-HARITA: run.py
- Gelistirme ortaminda ai-service uygulamasini baslatir.
- Uvicorn ile api.main:app hedefini calistirir.
"""

import os
import sys

import uvicorn


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    os.makedirs("logs", exist_ok=True)
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
