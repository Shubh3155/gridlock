"""
Zone routes — DBSCAN cluster zones with priority scores.
"""
from fastapi import APIRouter, HTTPException

import data_loader

router = APIRouter(prefix="/api", tags=["Zones"])


@router.get("/zones")
async def get_all_zones():
    """Return all DBSCAN zones as a GeoJSON FeatureCollection with priority scores."""
    geojson = data_loader.get_zones_geojson()
    return geojson


@router.get("/zones/{zone_id}")
async def get_zone_detail(zone_id: str):
    """
    Return a single zone's full detail by zone_id (e.g. 'cluster_0').
    Includes geometry, priority score, violation breakdown, and peak hour.
    """
    zone = data_loader.get_zone_by_id(zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")
    return zone


from pydantic import BaseModel, Field

class AddViolationRequest(BaseModel):
    violation_type: str = Field(..., description="Type of violation (e.g. 'NO PARKING')")
    weight: float = Field(default=1.0, description="Severity weight of the violation")


@router.post("/zones/{zone_id}/violations")
async def add_violation_to_zone(zone_id: str, body: AddViolationRequest):
    """
    Add a new violation to a specific zone in Firestore (or fallback locally).
    This increments the zone's violation count, updates its priority score,
    and refreshes the in-memory cache.
    """
    import os
    import json

    # We will try Firestore first
    try:
        from firebase_utils import get_firestore_client
        db = get_firestore_client()
        doc_ref = db.collection("zones").document(zone_id)
        doc = doc_ref.get()
        
        if doc.exists:
            feature = doc.to_dict()
            # Deserialize geometry string if present
            if "geometry" in feature and isinstance(feature["geometry"], str):
                feature["geometry"] = json.loads(feature["geometry"])
                
            props = feature.setdefault("properties", {})
            props["violation_count"] = props.get("violation_count", 0) + 1
            current_score = props.get("priority_score", 0.0)
            props["priority_score"] = round(min(10.0, current_score + 0.1), 2)
            
            tops = props.setdefault("top_violations", [])
            v_type = body.violation_type.upper()
            if v_type not in tops:
                tops.append(v_type)
                props["top_violations"] = tops[:3]
                
            # Copy and serialize geometry before saving to Firestore
            save_data = json.loads(json.dumps(feature))
            if "geometry" in save_data:
                save_data["geometry"] = json.dumps(save_data["geometry"])
                
            doc_ref.set(save_data)
            
            # Reset in-memory cache
            data_loader._zones_geojson = None
            data_loader._zones_by_id = None
            data_loader.load_all()
            
            updated_zone = data_loader.get_zone_by_id(zone_id)
            return {
                "status": "ok",
                "message": f"Violation added successfully in the cloud. Zone {zone_id} count incremented.",
                "zone_id": zone_id,
                "new_count": updated_zone["properties"]["violation_count"],
                "new_priority_score": updated_zone["properties"]["priority_score"]
            }
    except Exception as e:
        print(f"[ViolationRegistry] Firestore update failed ({str(e)}). Falling back to local disk...")

    # Fallback to local zones.geojson updates
    zone = data_loader.get_zone_by_id(zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")

    zones_path = data_loader._ZONES_PATH
    if not os.path.exists(zones_path):
        raise HTTPException(status_code=500, detail="zones.geojson fallback file not found on disk")

    try:
        with open(zones_path, "r") as f:
            geojson = json.load(f)

        found = False
        for feature in geojson.get("features", []):
            if feature.get("properties", {}).get("zone_id") == zone_id:
                props = feature["properties"]
                props["violation_count"] = props.get("violation_count", 0) + 1
                current_score = props.get("priority_score", 0.0)
                props["priority_score"] = round(min(10.0, current_score + 0.1), 2)
                
                tops = props.get("top_violations", [])
                v_type = body.violation_type.upper()
                if v_type not in tops:
                    tops.append(v_type)
                    props["top_violations"] = tops[:3]
                
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found in GeoJSON features")

        with open(zones_path, "w") as f:
            json.dump(geojson, f, indent=2)

        data_loader._zones_geojson = None
        data_loader._zones_by_id = None
        data_loader.load_all()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update zones.geojson fallback: {str(e)}")

    updated_zone = data_loader.get_zone_by_id(zone_id)
    return {
        "status": "ok",
        "message": f"Violation added successfully (local fallback). Zone {zone_id} count incremented.",
        "zone_id": zone_id,
        "new_count": updated_zone["properties"]["violation_count"],
        "new_priority_score": updated_zone["properties"]["priority_score"]
    }

