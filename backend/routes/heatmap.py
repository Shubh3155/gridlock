"""
Heatmap routes — historical violations and predicted likelihood grid.
"""
from fastapi import APIRouter, Query

import data_loader
from prediction_utils import predict_grid_likelihood

router = APIRouter(prefix="/api/heatmap", tags=["Heatmap"])


@router.get("/historical")
async def get_historical_heatmap():
    """
    Return historical violation points for Leaflet.heat rendering.
    Returns a list of {latitude, longitude, violation_weight} objects.
    Downsampled to max 20k points for performance.
    """
    points = data_loader.get_historical_heatmap()
    return {"count": len(points), "points": points}


@router.get("/predicted")
async def get_predicted_heatmap(
    hour: int = Query(default=8, ge=0, le=23, description="Hour of day (0-23)"),
    day_of_week: int = Query(default=1, ge=0, le=6, description="Day of week (0=Mon, 6=Sun)"),
):
    """
    Return predicted violation likelihood grid as GeoJSON FeatureCollection.
    Each point has a 'likelihood' property (0-1).
    Params hour and day_of_week control the temporal context for predictions.
    """
    geojson = predict_grid_likelihood(hour=hour, day_of_week=day_of_week)
    return geojson
