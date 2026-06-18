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
