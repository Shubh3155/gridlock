"""
Stats route — dashboard summary numbers.
"""
from fastapi import APIRouter

import data_loader
from schemas import StatsResponse

router = APIRouter(prefix="/api", tags=["Stats"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """
    Return dashboard summary stats:
    total violations, total zones, top police station, peak hour, avg risk score.
    """
    stats = data_loader.get_stats()
    return stats
