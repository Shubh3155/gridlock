import os
import json
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN
from scipy.spatial import ConvexHull

# Constants for tuning
DBSCAN_RADIUS_METERS = 200.0  # radius in meters
EARTH_RADIUS_METERS = 6371000.0
MIN_SAMPLES = 5  # minimum number of points to form a cluster

def get_fallback_polygon(center_lat, center_lng, radius_deg=0.00045):
    """
    Generates a small regular hexagon polygon around the center point.
    Used when a cluster has too few points or points are collinear.
    """
    angles = np.linspace(0, 2 * np.pi, 7)
    coordinates = []
    for angle in angles:
        lat = center_lat + radius_deg * np.sin(angle)
        lng = center_lng + radius_deg * np.cos(angle)
        coordinates.append([lng, lat]) # GeoJSON uses [longitude, latitude]
    return coordinates

def main():
    csv_path = "pipeline/output/violations_clean.csv"
    output_dir = "pipeline/output"
    output_geojson_path = os.path.join(output_dir, "zones.geojson")

    if not os.path.exists(csv_path):
        print(f"Error: clean dataset not found at {csv_path}. Run clean.py first.")
        return

    print(f"Loading cleaned violations from: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"Loaded {df.shape[0]} rows.")

    if df.empty:
        print("Empty dataset. Exiting.")
        return

    # Extract coordinates
    coords = df[['latitude', 'longitude']].values
    coords_rad = np.radians(coords)

    # Compute eps in radians
    eps_rad = DBSCAN_RADIUS_METERS / EARTH_RADIUS_METERS
    print(f"Running DBSCAN (radius={DBSCAN_RADIUS_METERS}m, eps={eps_rad:.7f} rad, min_samples={MIN_SAMPLES})...")

    db = DBSCAN(eps=eps_rad, min_samples=MIN_SAMPLES, metric='haversine').fit(coords_rad)
    df['cluster'] = db.labels_

    # Calculate cluster statistics
    num_clusters = len(set(db.labels_)) - (1 if -1 in db.labels_ else 0)
    num_noise = np.sum(db.labels_ == -1)
    print(f"DBSCAN found {num_clusters} clusters. Noise points: {num_noise} ({(num_noise/len(df))*100:.2f}%)")

    # Group by cluster, ignoring noise (-1)
    df_clustered = df[df['cluster'] != -1].copy()
    if df_clustered.empty:
        print("No clusters found. Try increasing DBSCAN_RADIUS_METERS or decreasing MIN_SAMPLES.")
        return

    zones = []
    
    # Calculate raw scores first to normalize them later
    raw_scores = []
    cluster_data = []

    for cluster_id, group in df_clustered.groupby('cluster'):
        center_lat = float(group['latitude'].mean())
        center_lng = float(group['longitude'].mean())
        violation_count = int(len(group))
        avg_violation_weight = float(group['violation_weight'].mean())
        
        # Junc ratio
        junction_ratio = float(group['near_junction'].mean())
        junction_multiplier = 1.0 + 0.2 * junction_ratio

        # Peak hour ratio
        peak_hour_ratio = float(group['is_peak_hour'].mean())
        time_multiplier = 1.0 + 0.3 * peak_hour_ratio

        # Raw score calculation
        raw_score = violation_count * avg_violation_weight * time_multiplier * junction_multiplier
        raw_scores.append(raw_score)

        # Most common features
        top_violations = group['primary_violation'].value_counts().head(3).index.tolist()
        
        # Peak hour (find the mode hour, format as HH:00)
        mode_hour = int(group['hour'].mode().iloc[0]) if not group['hour'].empty else 12
        peak_hour_str = f"{mode_hour:02d}:00"

        # Police station (mode)
        police_station = str(group['police_station'].mode().iloc[0]) if not group['police_station'].empty else "Unknown"
        
        # Get coordinates for geometry
        pts = group[['longitude', 'latitude']].values  # GeoJSON is [longitude, latitude]
        unique_pts = np.unique(pts, axis=0)

        # Try to build convex hull polygon
        geometry_coords = []
        if len(unique_pts) >= 3:
            try:
                hull = ConvexHull(unique_pts)
                # Convex hull vertices in counter-clockwise order
                hull_vertices = unique_pts[hull.vertices]
                geometry_coords = hull_vertices.tolist()
                # Close the polygon (GeoJSON requires first and last point to be identical)
                geometry_coords.append(geometry_coords[0])
            except Exception:
                # Fallback if SciPy ConvexHull fails (e.g. collinear points)
                geometry_coords = get_fallback_polygon(center_lat, center_lng)
        else:
            # Fallback for small number of unique coordinates
            geometry_coords = get_fallback_polygon(center_lat, center_lng)

        cluster_data.append({
            "cluster_id": int(cluster_id),
            "center_lat": center_lat,
            "center_lng": center_lng,
            "violation_count": violation_count,
            "avg_violation_weight": avg_violation_weight,
            "junction_ratio": junction_ratio,
            "peak_hour_ratio": peak_hour_ratio,
            "top_violations": top_violations,
            "peak_hour": peak_hour_str,
            "police_station": police_station,
            "raw_score": raw_score,
            "geometry_coords": geometry_coords
        })

    # Normalize priority scores to 0-10 using log-scaling to handle skew
    raw_scores = np.array(raw_scores)
    log_raw_scores = np.log1p(raw_scores)
    min_log = log_raw_scores.min()
    max_log = log_raw_scores.max()
    print(f"Raw scores range: min={raw_scores.min():.2f}, max={raw_scores.max():.2f}")
    print(f"Log-transformed range: min={min_log:.2f}, max={max_log:.2f}")

    geojson_features = []
    
    for item in cluster_data:
        # Scale log raw score to 0-10
        if max_log > min_log:
            priority_score = round(10.0 * (np.log1p(item["raw_score"]) - min_log) / (max_log - min_log), 1)
        else:
            priority_score = 5.0

        # Construct GeoJSON Feature
        feature = {
            "type": "Feature",
            "id": f"zone_{item['cluster_id']}",
            "geometry": {
                "type": "Polygon",
                "coordinates": [item["geometry_coords"]]
            },
            "properties": {
                "zone_id": f"cluster_{item['cluster_id']}",
                "priority_score": priority_score,
                "violation_count": item["violation_count"],
                "avg_violation_weight": round(item["avg_violation_weight"], 2),
                "top_violations": item["top_violations"],
                "peak_hour": item["peak_hour"],
                "police_station": item["police_station"],
                "junction_ratio": round(item["junction_ratio"], 2),
                "peak_hour_ratio": round(item["peak_hour_ratio"], 2),
                "center": {
                    "lat": item["center_lat"],
                    "lng": item["center_lng"]
                }
            }
        }
        geojson_features.append(feature)

    geojson_output = {
        "type": "FeatureCollection",
        "features": geojson_features
    }

    # Save to file
    print(f"Saving GeoJSON to: {output_geojson_path}")
    with open(output_geojson_path, 'w') as f:
        json.dump(geojson_output, f, indent=2)

    print("Phase 2 - Core Intelligence Layer finished successfully!")
    print(f"Generated {len(geojson_features)} priority zones.")

if __name__ == "__main__":
    main()
