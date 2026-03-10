"""
Başlatmak için:
  cd ai-service
  python run.py
"""
import sys
import os

# ai-service/ klasörünü Python path'e ekle
sys.path.insert(0, os.path.dirname(__file__))

import uvicorn

if __name__ == "__main__":
    os.makedirs("logs", exist_ok=True)
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
