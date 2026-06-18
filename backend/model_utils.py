"""
Model utility — single-point prediction wrapper around the trained XGBoost model.
"""
import numpy as np
import pandas as pd
from prediction_utils import get_model_data


def predict_single(lat: float, lng: float, hour: int, day_of_week: int) -> dict:
    """
    Predict violation likelihood for a single (lat, lng, hour, day_of_week) input.

    Returns:
        {
            "likelihood_score": float (0-1),
            "risk_tier": "Low" | "Medium" | "High"
        }
    """
    model_data, tree = get_model_data()
    model = model_data["model"]

    # Spatial queries against historical data
    point = np.array([[lat, lng]])
    distances, indices = tree.query(point, k=1)
    dist = distances[0, 0]
    idx = indices[0, 0]

    # 50m radius count
    repeat_count = tree.query_radius(point, r=0.00045, count_only=True)[0]

    # Peak hour flag
    is_peak_hour = 1 if (7 <= hour <= 10) or (17 <= hour <= 20) else 0

    # Spatial feature lookup (use nearest historical point if close enough)
    MAX_DIST_DEG = 0.0027  # ~300 meters
    is_close = dist <= MAX_DIST_DEG

    hist_spatial = model_data["hist_spatial_features"]
    near_junction = int(hist_spatial["near_junction"][idx]) if is_close else 0
    cluster_density = float(hist_spatial["cluster_density"][idx]) if is_close else 0.0
    police_station_load = int(hist_spatial["police_station_load"][idx]) if is_close else 0
    is_near_commercial = int(hist_spatial["is_near_commercial"][idx]) if is_close else 0
    violation_weight = float(hist_spatial["violation_weight"][idx]) if is_close else model_data["default_violation_weight"]

    # Build feature row matching the model's expected column order
    feature_dict = {
        "latitude": lat,
        "longitude": lng,
        "near_junction": near_junction,
        "cluster_density": cluster_density,
        "repeat_location_count": repeat_count,
        "hour": hour,
        "day_of_week": day_of_week,
        "is_peak_hour": is_peak_hour,
        "vehicle_type_encoded": model_data["default_vehicle_encoded"],
        "violation_weight": violation_weight,
        "police_station_load": police_station_load,
        "is_near_commercial": is_near_commercial,
    }

    df_input = pd.DataFrame([feature_dict])[model_data["features"]]
    score = float(np.clip(model.predict(df_input)[0], 0.0, 1.0))

    # Risk tier
    if score > 0.65:
        tier = "High"
    elif score > 0.35:
        tier = "Medium"
    else:
        tier = "Low"

    return {"likelihood_score": round(score, 4), "risk_tier": tier}
