import os
import json
import numpy as np
import pandas as pd
from sklearn.neighbors import KDTree
import joblib

# Cache the model data in memory
_MODEL_DATA = None
_KDTREE = None

def get_model_data():
    global _MODEL_DATA, _KDTREE
    if _MODEL_DATA is None:
        model_path = os.path.join(os.path.dirname(__file__), "models", "violation_likelihood.pkl")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Please run pipeline/score.py first.")
        _MODEL_DATA = joblib.load(model_path)
        _KDTREE = KDTree(_MODEL_DATA['hist_coords'])
    return _MODEL_DATA, _KDTREE

def predict_grid_likelihood(hour: int, day_of_week: int):
    """
    Generates a high-resolution grid anchored around historical hotspot cluster centers,
    and predicts the violation likelihood for each point at a given hour and day of week.
    Returns a GeoJSON FeatureCollection containing points with predicted likelihood scores.
    """
    model_data, tree = get_model_data()
    model = model_data['model']
    hist_coords = model_data['hist_coords']

    # 1. Load cluster centers from zones.geojson
    # Relative path from backend/
    zones_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pipeline", "output", "zones.geojson")
    
    centers = []
    if os.path.exists(zones_path):
        try:
            with open(zones_path, 'r') as f:
                zones_data = json.load(f)
            for feature in zones_data.get('features', []):
                center = feature.get('properties', {}).get('center')
                if center:
                    centers.append([center['lat'], center['lng']])
        except Exception as e:
            print(f"Warning: Failed to parse zones.geojson: {e}")
            
    # Fallback if zones.geojson doesn't exist or is empty
    if not centers:
        print("Warning: zones.geojson not found or empty. Using sample of historical coordinates as grid anchors.")
        # Sample 100 random coordinates from historical data
        indices = np.random.choice(len(hist_coords), min(100, len(hist_coords)), replace=False)
        centers = hist_coords[indices].tolist()

    # 2. For each center, generate a 5x5 grid (25 points)
    # 0.001 degrees latitude ≈ 110 meters, so +/- 0.002 covers a ~440m x 440m box
    grid_offset = np.linspace(-0.002, 0.002, 5)
    
    grid_points = []
    for lat, lng in centers:
        for d_lat in grid_offset:
            for d_lng in grid_offset:
                grid_points.append([lat + d_lat, lng + d_lng])
                
    grid_coords = np.array(grid_points)
    
    # 3. Spatial queries for features
    distances, indices = tree.query(grid_coords, k=1)
    distances = distances.flatten()
    indices = indices.flatten()

    # 50m radius counts to capture micro-location risk (50m in degrees ≈ 0.00045)
    repeat_counts = tree.query_radius(grid_coords, r=0.00045, count_only=True)

    # 4. Build feature matrix
    is_peak_hour = 1 if (7 <= hour <= 10) or (17 <= hour <= 20) else 0
    MAX_DIST_DEG = 0.0027  # ~300 meters

    hist_junctions = model_data['hist_spatial_features']['near_junction']
    hist_densities = model_data['hist_spatial_features']['cluster_density']
    hist_loads = model_data['hist_spatial_features']['police_station_load']
    hist_commercials = model_data['hist_spatial_features']['is_near_commercial']
    hist_severities = model_data['hist_spatial_features']['violation_weight']

    is_close = distances <= MAX_DIST_DEG

    near_junction = np.where(is_close, hist_junctions[indices], 0)
    cluster_density = np.where(is_close, hist_densities[indices], 0.0)
    police_station_load = np.where(is_close, hist_loads[indices], 0)
    is_near_commercial = np.where(is_close, hist_commercials[indices], 0)
    violation_weight = np.where(is_close, hist_severities[indices], model_data['default_violation_weight'])

    df_grid = pd.DataFrame({
        'latitude': grid_coords[:, 0],
        'longitude': grid_coords[:, 1],
        'near_junction': near_junction,
        'cluster_density': cluster_density,
        'repeat_location_count': repeat_counts,
        'hour': hour,
        'day_of_week': day_of_week,
        'is_peak_hour': is_peak_hour,
        'vehicle_type_encoded': model_data['default_vehicle_encoded'],
        'violation_weight': violation_weight,
        'police_station_load': police_station_load,
        'is_near_commercial': is_near_commercial
    })

    # Ensure column order matches feature list
    df_grid = df_grid[model_data['features']]

    # 5. Predict likelihood
    predictions = model.predict(df_grid)
    predictions = np.clip(predictions, 0.0, 1.0)

    # 6. Format as GeoJSON FeatureCollection
    features = []
    # Deduplicate coordinates (grid points from overlapping clusters)
    seen_coords = set()
    
    for idx, pred in enumerate(predictions):
        # Only return points with non-trivial likelihood to keep map clean
        if pred < 0.15:
            continue
            
        lat = float(grid_coords[idx, 0])
        lng = float(grid_coords[idx, 1])
        
        # Round to prevent tiny floating point variations in coordinate keys
        coord_key = (round(lat, 5), round(lng, 5))
        if coord_key in seen_coords:
            continue
        seen_coords.add(coord_key)
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat]
            },
            "properties": {
                "likelihood": round(float(pred), 3)
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }

if __name__ == "__main__":
    # Test script locally
    try:
        print("Testing predict_grid_likelihood for Mon 8am...")
        geojson = predict_grid_likelihood(hour=8, day_of_week=0)
        print(f"Prediction successful! Generated {len(geojson['features'])} active likelihood points.")
        # Print a sample point
        if geojson['features']:
            print("Sample point:", geojson['features'][0])
    except Exception as e:
        print("Test failed:", e)
