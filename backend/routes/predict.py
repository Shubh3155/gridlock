"""
Predict route — single-point violation likelihood prediction.
"""
from fastapi import APIRouter

from schemas import PredictRequest, PredictResponse
from model_utils import predict_single

router = APIRouter(prefix="/api", tags=["Prediction"])


@router.post("/predict", response_model=PredictResponse)
async def predict_likelihood(body: PredictRequest):
    """
    Predict the violation likelihood for a given location and time.

    Accepts: lat, lng, hour (0-23), day_of_week (0=Mon, 6=Sun)
    Returns: likelihood_score (0-1) and risk_tier (Low/Medium/High)
    """
    result = predict_single(
        lat=body.lat,
        lng=body.lng,
        hour=body.hour,
        day_of_week=body.day_of_week,
    )
    return result
