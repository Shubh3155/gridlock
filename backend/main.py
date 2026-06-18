"""
Gridlock FastAPI Backend
========================
Traffic violation prediction & enforcement intelligence API.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data_loader import load_all
from routes import zones, heatmap, stats, predict, auth


# ── Lifespan: preload data on startup ──────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model + data into memory before serving requests."""
    print("🚀 Starting Gridlock API — loading data...")
    load_all()
    print("✅ Data loaded. Server ready.")
    yield
    print("🛑 Shutting down Gridlock API.")


# ── App ─────────────────────────────────────────────────────

app = FastAPI(
    title="Gridlock API",
    description="AI-driven parking violation prediction & enforcement intelligence",
    version="1.0.0",
    lifespan=lifespan,
)


# ── CORS ────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",       # Next.js dev
        "http://127.0.0.1:3000",
        "https://gridlock.vercel.app", # production (update as needed)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ─────────────────────────────────────────────────

app.include_router(zones.router)
app.include_router(heatmap.router)
app.include_router(stats.router)
app.include_router(predict.router)
app.include_router(auth.router)


# ── Health check ────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "gridlock-api"}
