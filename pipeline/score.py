import os
import json
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from sklearn.neighbors import KDTree
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
from scipy.spatial import ConvexHull
from xgboost import XGBRegressor
import joblib

# Constants
DBSCAN_RADIUS_METERS = 200.0
EARTH_RADIUS_METERS = 6371000.0
MIN_SAMPLES = 5
SPACE_NEIGHBOR_RADIUS_DEG = 0.00045  # ~50 meters in degrees

def compute_cluster_densities(df):
    """
    Computes the spatial density of each cluster (violations per sq km).
    """
    print("Computing cluster densities...")
    # Group by cluster (excluding noise -1)
    df_clustered = df[df['cluster'] != -1]
    
    cluster_densities = {}
    
    for cluster_id, group in df_clustered.groupby('cluster'):
        cluster_size = len(group)
        pts = group[['longitude', 'latitude']].values
        unique_pts = np.unique(pts, axis=0)
        
        # Calculate cluster area in sq km
        area_sq_km = 0.0314  # Default fallback area (~100m radius circle area)
        
        if len(unique_pts) >= 3:
            try:
                hull = ConvexHull(unique_pts)
                # hull.volume is the area in 2D (degrees squared)
                area_deg_squared = hull.volume
                # Approximate conversion to sq km: 1 deg lat ~ 111km, 1 deg lng ~ 108km in Bangalore
                # Area in sq km ≈ area_deg_squared * 111 * 108
                area_sq_km = max(area_deg_squared * 12000.0, 0.001)
            except Exception:
                pass
                
        cluster_densities[cluster_id] = cluster_size / area_sq_km
        
    # Noise points get density 0
    cluster_densities[-1] = 0.0
    return cluster_densities

def compute_time_space_density(df, coords, tree):
    """
    For each point, counts the number of violations within 50m AND within +/- 1 hour.
    """
    print("Computing space-time density for target label...")
    # Query all points within 50m radius
    indices = tree.query_radius(coords, r=SPACE_NEIGHBOR_RADIUS_DEG)
    
    hours = df['hour'].values
    time_space_counts = []
    
    for i in range(len(df)):
        neigh_idx = indices[i]
        if len(neigh_idx) <= 1:
            time_space_counts.append(1) # Just itself
            continue
            
        # Get hours of neighbors
        neigh_hours = hours[neigh_idx]
        # Calculate hourly difference (handling circular 24h clock)
        diff = np.abs(neigh_hours - hours[i])
        diff = np.minimum(diff, 24 - diff)
        
        # Count neighbors within 1 hour
        time_space_counts.append(np.sum(diff <= 1))
        
    return np.array(time_space_counts)

def main():
    csv_path = "pipeline/output/violations_clean.csv"
    model_dir = "backend/models"
    model_path = os.path.join(model_dir, "violation_likelihood.pkl")
    
    if not os.path.exists(csv_path):
        print(f"Error: clean dataset not found at {csv_path}. Run clean.py first.")
        return

    print(f"Loading cleaned violations from: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"Loaded {df.shape[0]} rows.")

    # 1. DBSCAN Clustering for cluster density features
    print("Clustering for density feature...")
    coords = df[['latitude', 'longitude']].values
    coords_rad = np.radians(coords)
    eps_rad = DBSCAN_RADIUS_METERS / EARTH_RADIUS_METERS
    
    db = DBSCAN(eps=eps_rad, min_samples=MIN_SAMPLES, metric='haversine').fit(coords_rad)
    df['cluster'] = db.labels_
    
    cluster_densities = compute_cluster_densities(df)
    df['cluster_density'] = df['cluster'].map(cluster_densities)

    # 2. Build Spatial Index Tree
    tree = KDTree(coords)

    # 3. Compute target variable (normalized space-time violation density)
    time_space_counts = compute_time_space_density(df, coords, tree)
    
    # Normalize to 0-1 scale using log-scaling to handle skew
    min_count = time_space_counts.min()
    max_count = time_space_counts.max()
    log_counts = np.log1p(time_space_counts)
    min_log = log_counts.min()
    max_log = log_counts.max()
    print(f"Space-time counts: min={min_count}, max={max_count}")
    print(f"Log space-time counts: min={min_log:.4f}, max={max_log:.4f}")
    df['violation_likelihood_score'] = (log_counts - min_log) / (max_log - min_log)

    # 4. Feature Engineering & Preprocessing
    print("Preprocessing features...")
    # Label encode vehicle type
    df['vehicle_type'] = df['vehicle_type'].fillna('UNKNOWN')
    le_vehicle = LabelEncoder()
    df['vehicle_type_encoded'] = le_vehicle.fit_transform(df['vehicle_type'])

    # Historical violations count at 50m radius (overall spatial hotspot intensity)
    print("Computing spatial-only count feature...")
    df['repeat_location_count'] = tree.query_radius(coords, r=SPACE_NEIGHBOR_RADIUS_DEG, count_only=True)

    # Police station load
    station_loads = df['police_station'].value_counts().to_dict()
    df['police_station_load'] = df['police_station'].map(station_loads).fillna(0)

    # Commercial proxy (density > 75th percentile of clustered areas)
    q75 = df[df['cluster'] != -1]['cluster_density'].quantile(0.75) if not df[df['cluster'] != -1].empty else 0
    df['is_near_commercial'] = df['cluster_density'].apply(lambda d: 1 if d > q75 else 0)

    # Features list
    features = [
        'latitude', 'longitude',
        'near_junction',            # is_junction
        'cluster_density',
        'repeat_location_count',
        'hour',                     # hour_of_day
        'day_of_week',
        'is_peak_hour',
        'vehicle_type_encoded',
        'violation_weight',         # violation_severity
        'police_station_load',
        'is_near_commercial'
    ]

    X = df[features]
    y = df['violation_likelihood_score']

    print("Splitting train and test sets...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 5. Train XGBoost model
    print("Training XGBoost Regressor model...")
    model = XGBRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)

    # 6. Evaluate
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    print(f"XGBoost Model Trained! Evaluation RMSE: {rmse:.4f}")

    # 7. Save Model & Metadata Dictionary
    print(f"Saving model and metadata to: {model_path}")
    os.makedirs(model_dir, exist_ok=True)
    
    model_data = {
        'model': model,
        'features': features,
        'le_vehicle': le_vehicle,
        'station_loads': station_loads,
        'cluster_densities': cluster_densities,
        'q75_density_threshold': q75,
        'hist_coords': coords,
        'hist_spatial_features': {
            'near_junction': df['near_junction'].values,
            'cluster_density': df['cluster_density'].values,
            'repeat_location_count': df['repeat_location_count'].values,
            'police_station_load': df['police_station_load'].values,
            'is_near_commercial': df['is_near_commercial'].values,
            'violation_weight': df['violation_weight'].values
        },
        'default_vehicle_encoded': int(df['vehicle_type_encoded'].mode()[0]),
        'default_violation_weight': float(df['violation_weight'].mean())
    }
    
    joblib.dump(model_data, model_path)
    print("Phase 2 regression model saved successfully!")

if __name__ == "__main__":
    main()
