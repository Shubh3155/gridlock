export interface Center {
  lat: number;
  lng: number;
}

export interface ZoneProperties {
  zone_id: string;
  priority_score: number;
  violation_count: number;
  avg_violation_weight: number;
  top_violations: string[];
  peak_hour: string;
  police_station: string;
  junction_ratio: number;
  peak_hour_ratio: number;
  center: Center;
  enforcement_brief?: string; // Cacheable AI recommendations
}

export interface ZoneGeometry {
  type: "Polygon";
  coordinates: number[][][]; // GeoJSON format: [[[lng, lat], ...]]
}

export interface ZoneFeature {
  type: "Feature";
  id: string;
  geometry: ZoneGeometry;
  properties: ZoneProperties;
}

export interface ZoneFeatureCollection {
  type: "FeatureCollection";
  features: ZoneFeature[];
}

export interface Stats {
  total_violations: number;
  total_zones: number;
  top_station: string;
  peak_hour: string;
  avg_risk_score: number;
}

export interface ViolationPoint {
  latitude: number;
  longitude: number;
  violation_weight: number;
}

export interface HistoricalHeatmapResponse {
  count: number;
  points: ViolationPoint[];
}

export interface PredictRequest {
  lat: number;
  lng: number;
  hour: number;
  day_of_week: number;
}

export interface PredictResponse {
  likelihood_score: number;
  risk_tier: "Low" | "Medium" | "High";
}

export interface UserSession {
  session_id: string;
  uid: string;
  email: string | null;
  display_name: string | null;
  photo_url?: string | null;
}
