"""
FuzzyPeanut Module Registry

Modules POST their manifest here on startup. The shell queries this service
to discover installed modules. Changes are pushed to the shell via SSE.
"""
from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
REDIS_KEY = "fp:modules"

# CORS — comma-separated list of allowed origins. Default "*" for dev.
# In production, set to the shell's origin: e.g. "https://app.example.com"
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")]

# Optional modules.json path — pinned module URLs loaded on startup.
# Live self-registration overwrites pinned entries for the same module ID.
MODULES_JSON_PATH = os.environ.get("MODULES_JSON", "")

# Shared Redis client — created on startup, shared across all requests.
_redis: aioredis.Redis | None = None

# In-memory SSE subscriber queues
_subscribers: list[asyncio.Queue[str]] = []


async def _get_redis() -> aioredis.Redis:
    assert _redis is not None, "Redis client not initialized"
    return _redis


async def _broadcast(event: dict[str, Any]) -> None:
    msg = json.dumps(event)
    for q in list(_subscribers):
        await q.put(msg)


async def _load_pinned_modules(r: aioredis.Redis) -> None:
    """Load modules.json into Redis on startup as pinned defaults."""
    if not MODULES_JSON_PATH or not os.path.exists(MODULES_JSON_PATH):
        return
    try:
        with open(MODULES_JSON_PATH) as f:
            pinned: list[dict] = json.load(f)
        for mod in pinned:
            await r.hset(REDIS_KEY, mod["id"], json.dumps(mod))
        print(f"[registry] Loaded {len(pinned)} pinned module(s) from {MODULES_JSON_PATH}")
    except Exception as e:
        print(f"[registry] Warning: could not load modules.json: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _redis
    _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    await _load_pinned_modules(_redis)
    yield
    await _redis.aclose()


app = FastAPI(title="FuzzyPeanut Registry", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NavItem(BaseModel):
    label: str
    icon: str
    order: int = 99


class ModuleRegistration(BaseModel):
    id: str
    displayName: str
    version: str
    remoteEntry: str
    routes: list[str]
    nav: NavItem | None = None
    provides: list[str] = []
    consumes: list[str] = []


@app.get("/modules")
async def list_modules() -> list[dict]:
    r = await _get_redis()
    raw = await r.hvals(REDIS_KEY)
    return [json.loads(v) for v in raw]


@app.post("/modules", status_code=201)
async def register_module(mod: ModuleRegistration) -> dict:
    r = await _get_redis()
    data = mod.model_dump()
    await r.hset(REDIS_KEY, mod.id, json.dumps(data))
    await _broadcast({"type": "added", "module": data})
    return data


@app.delete("/modules/{module_id}", status_code=204)
async def deregister_module(module_id: str) -> None:
    r = await _get_redis()
    removed = await r.hdel(REDIS_KEY, module_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Module not found")
    await _broadcast({"type": "removed", "module": {"id": module_id}})


@app.get("/events")
async def sse_events(request: Request) -> StreamingResponse:
    """Server-Sent Events stream for live module registration changes."""
    queue: asyncio.Queue[str] = asyncio.Queue()
    _subscribers.append(queue)

    async def stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            _subscribers.remove(queue)

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/health")
async def health() -> dict:
    r = await _get_redis()
    await r.ping()
    return {"status": "ok"}
