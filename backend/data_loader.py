"""
Singleton data loader — reads pipeline outputs once at startup and caches in memory.
"""
import os
import json
import pandas as pd
import numpy as np
from functools import lru_cache

# Resolve paths relative to this file
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BASE_DIR)
_ZONES_PATH = os.path.join(_PROJECT_ROOT, "pipeline", "output", "zones.geojson")
_CSV_PATH = os.path.join(_PROJECT_ROOT, "pipeline", "output", "violations_clean.csv")

# In-memory cache
_zones_geojson: dict | None = None
_zones_by_id: dict | None = None
_stats: dict | None = None
_historical_heatmap: list | None = None


def _load_zones_local_fallback():
    """Parse local zones.geojson into memory as fallback."""
    global _zones_geojson, _zones_by_id
    if not os.path.exists(_ZONES_PATH):
        print(f"WARNING: Fallback zones.geojson not found at {_ZONES_PATH}")
        _zones_geojson = {"type": "FeatureCollection", "features": []}
        _zones_by_id = {}
        return

    with open(_ZONES_PATH, "r") as f:
        _zones_geojson = json.load(f)

    _zones_by_id = {}
    for feature in _zones_geojson.get("features", []):
        zone_id = feature.get("properties", {}).get("zone_id")
        if zone_id:
            _zones_by_id[zone_id] = feature


def _load_zones():
    """Load zones from Firestore with local zones.geojson fallback."""
    global _zones_geojson, _zones_by_id
    if _zones_geojson is not None:
        return

    print("[DataLoader] Querying zones from Firestore cloud database...")
    try:
        from firebase_utils import get_firestore_client
        db = get_firestore_client()
        
        # Stream zones collection documents
        docs = db.collection("zones").stream()
        
        import json
        features = []
        _zones_by_id = {}
        for doc in docs:
            feature = doc.to_dict()
            if "geometry" in feature and isinstance(feature["geometry"], str):
                try:
                    feature["geometry"] = json.loads(feature["geometry"])
                except Exception as ex:
                    print(f"[DataLoader] Failed to deserialize geometry for doc {doc.id}: {ex}")
            features.append(feature)
            zone_id = feature.get("properties", {}).get("zone_id")
            if zone_id:
                _zones_by_id[zone_id] = feature

        # If Firestore collection is empty/failed, use fallback
        if not features:
            print("[DataLoader] Firestore zones collection is empty. Falling back to local disk.")
            _load_zones_local_fallback()
            return
            
        _zones_geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        print(f"[DataLoader] Successfully loaded {len(features)} zones from Firestore.")
    except Exception as e:
        print(f"[DataLoader] WARNING: Firestore load failed ({str(e)}). Falling back to local disk.")
        _load_zones_local_fallback()


def _load_csv_data():
    """Parse violations CSV and compute summary stats + historical heatmap points."""
    global _stats, _historical_heatmap
    if _stats is not None:
        return

    if not os.path.exists(_CSV_PATH):
        print(f"WARNING: violations_clean.csv not found at {_CSV_PATH}")
        _stats = {
            "total_violations": 0,
            "total_zones": 0,
            "top_station": "N/A",
            "peak_hour": "N/A",
            "avg_risk_score": 0.0,
        }
        _historical_heatmap = []
        return

    df = pd.read_csv(_CSV_PATH, low_memory=False)

    # Summary stats
    total_violations = len(df)
    top_station = str(df["police_station"].value_counts().idxmax()) if not df["police_station"].empty else "N/A"
    peak_hour_val = int(df["hour"].mode().iloc[0]) if not df["hour"].empty else 0
    peak_hour = f"{peak_hour_val:02d}:00"

    # Zone count + avg risk from geojson (ensure zones loaded first)
    _load_zones()
    total_zones = len(_zones_by_id) if _zones_by_id else 0
    avg_risk = 0.0
    if _zones_geojson and _zones_geojson.get("features"):
        scores = [f["properties"].get("priority_score", 0) for f in _zones_geojson["features"]]
        avg_risk = round(float(np.mean(scores)), 2) if scores else 0.0

    _stats = {
        "total_violations": total_violations,
        "total_zones": total_zones,
        "top_station": top_station,
        "peak_hour": peak_hour,
        "avg_risk_score": avg_risk,
    }

    # Historical heatmap: lat, lng, weight (violation_weight)
    # Downsample if dataset is huge (>20k points) to keep response fast
    heatmap_df = df[["latitude", "longitude", "violation_weight"]].dropna()
    if len(heatmap_df) > 20000:
        heatmap_df = heatmap_df.sample(n=20000, random_state=42)

    _historical_heatmap = heatmap_df.to_dict(orient="records")


# ── Public API ──────────────────────────────────────────────

def load_all():
    """Pre-load all data at startup."""
    _load_zones()
    _load_csv_data()
    print(f"[DataLoader] Loaded {len(_zones_by_id or {})} zones, {_stats.get('total_violations', 0)} violations")


def get_zones_geojson() -> dict:
    _load_zones()
    return _zones_geojson


def get_zone_by_id(zone_id: str) -> dict | None:
    _load_zones()
    return _zones_by_id.get(zone_id)


def get_stats() -> dict:
    _load_csv_data()
    return _stats


def get_historical_heatmap() -> list:
    _load_csv_data()
    return _historical_heatmap
