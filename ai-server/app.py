import json
import os
import re
from typing import Literal

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
API_TOKEN = os.getenv("TAGNIVRA_API_TOKEN", "")

app = FastAPI(title="Tagnivra Self-Hosted AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv(
        "ALLOWED_ORIGINS",
        "https://thatosenyum95-ship-it.github.io"
    ).split(",") if x.strip()],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class GenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=500)
    platform: str = Field(default="youtube", max_length=20)
    language: Literal["id", "en", "mix"] = "id"
    style: str = Field(default="general", max_length=40)


def clean_list(value, hashtag: bool, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    out = []
    for item in value:
        item = re.sub(r"[\r\n]+", " ", str(item or "")).strip()[:90]
        if not item:
            continue
        if hashtag:
            item = "#" + re.sub(r"[^\w]", "", item.lstrip("#"), flags=re.UNICODE)
        if item and item != "#" and item not in out:
            out.append(item)
        if len(out) >= limit:
            break
    return out


@app.get("/health")
async def health():
    return {"ok": True, "service": "Tagnivra Self-Hosted AI", "model": OLLAMA_MODEL}


@app.post("/generate")
async def generate(body: GenerateRequest, authorization: str | None = Header(default=None)):
    if API_TOKEN and authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    platform = body.platform.strip().lower()
    platform_map = {"youtube": "youtube", "tiktok": "tiktok", "facebook": "facebook"}
    if platform not in platform_map:
        platform = "youtube"
    language = {"id": "Indonesian", "en": "English", "mix": "Indonesian and English"}[body.language]
    prompt = f"""
You are Tagnivra, an assistant specialized in social-media keywords.
Create useful, relevant keywords and hashtags from the user's topic. Do not claim these are trending or based on live popularity data.
Platform: {platform}
Output language: {language}
Content type: {body.style}
Topic: {body.topic}

Return ONLY valid JSON in this exact shape:
{{"hashtags":["without # prefix"],"keywords":["search phrase"],"note":"short explanation"}}
Give 8-10 hashtags and 8-12 distinct keywords. Avoid duplicates, spam, misleading tags, and unrelated popular tags.
"""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.35, "num_predict": 700},
    }
    try:
        async with httpx.AsyncClient(timeout=150.0) as client:
            response = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            response.raise_for_status()
            raw = response.json().get("response", "")
        parsed = json.loads(raw)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI memerlukan waktu terlalu lama. Coba lagi.")
    except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=f"Model AI belum siap atau menghasilkan jawaban tidak valid: {type(exc).__name__}")

    hashtags = clean_list(parsed.get("hashtags"), True, 10)
    keywords = clean_list(parsed.get("keywords"), False, 12)
    if len(hashtags) < 3 or len(keywords) < 3:
        raise HTTPException(status_code=502, detail="Hasil AI terlalu sedikit. Coba topik yang lebih jelas.")

    return {
        "ok": True,
        "platform": platform,
        "topic": body.topic,
        "hashtags": hashtags,
        "keywords": keywords,
        "note": str(parsed.get("note") or "Saran berdasarkan konteks topik, bukan data tren real-time.")[:180],
        "model": OLLAMA_MODEL,
    }
