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
    """Load model + data into memory before serving requests, migrating zones to Firestore if empty."""
    print("🚀 Starting Gridlock API — loading data...")
    
    # Run dynamic Firestore zones migration check
    try:
        from firebase_utils import get_firestore_client
        db = get_firestore_client()
        zones_ref = db.collection("zones")
        
        # Check if collection is empty
        docs = list(zones_ref.limit(1).stream())
        if not docs:
            print("[Migration] Firestore zones collection is empty. Migrating local zones.geojson to the cloud...")
            import json
            from data_loader import _ZONES_PATH
            if os.path.exists(_ZONES_PATH):
                with open(_ZONES_PATH, "r") as f:
                    geojson = json.load(f)
                
                batch = db.batch()
                count = 0
                for feature in geojson.get("features", []):
                    zone_id = feature.get("properties", {}).get("zone_id")
                    if zone_id:
                        # Copy and serialize geometry to bypass Firestore nested array limitation
                        doc_data = json.loads(json.dumps(feature))
                        if "geometry" in doc_data:
                            doc_data["geometry"] = json.dumps(doc_data["geometry"])
                        
                        doc_ref = zones_ref.document(zone_id)
                        batch.set(doc_ref, doc_data)
                        count += 1
                        # Batch write limits are 500
                        if count % 400 == 0:
                            batch.commit()
                            batch = db.batch()
                batch.commit()
                print(f"[Migration] Successfully migrated {count} zones to Firestore cloud.")
            else:
                print("[Migration] ERROR: local zones.geojson not found, cannot migrate.")
        else:
            print("[Migration] Firestore zones collection already populated. Skipping migration.")
    except Exception as e:
        print(f"[Migration] WARNING: Firestore connection/migration failed: {str(e)}")

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
