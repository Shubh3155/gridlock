"""
Pydantic request/response schemas for Gridlock API.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ── Prediction ──────────────────────────────────────────────

class PredictRequest(BaseModel):
    lat: float = Field(..., description="Latitude of the point")
    lng: float = Field(..., description="Longitude of the point")
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Mon, 6=Sun)")


class PredictResponse(BaseModel):
    likelihood_score: float
    risk_tier: str  # "Low", "Medium", "High"


# ── Auth ────────────────────────────────────────────────────

class TokenVerifyRequest(BaseModel):
    id_token: str = Field(..., description="Firebase ID token from client")


class SessionResponse(BaseModel):
    session_id: str
    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None


class FCMTokenRequest(BaseModel):
    fcm_token: str = Field(..., description="Firebase Cloud Messaging token")


# ── Stats ───────────────────────────────────────────────────

class StatsResponse(BaseModel):
    total_violations: int
    total_zones: int
    top_station: str
    peak_hour: str
    avg_risk_score: float
