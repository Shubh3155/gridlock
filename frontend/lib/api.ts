import {
  Stats,
  ZoneFeatureCollection,
  ZoneFeature,
  HistoricalHeatmapResponse,
  PredictRequest,
  PredictResponse,
  UserSession,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Helper for HTTP requests
async function request<T>(
  path: string,
  options?: RequestInit,
  authToken?: string
): Promise<T> {
  const headers = new Headers(options?.headers || {});
  headers.set("Content-Type", "application/json");
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getStats: () => request<Stats>("/api/stats"),
  
  getZones: () => request<ZoneFeatureCollection>("/api/zones"),
  
  getZoneDetail: (zoneId: string, authToken?: string) => 
    request<ZoneFeature>(`/api/zones/${zoneId}`, {}, authToken),

  getHistoricalHeatmap: () => request<HistoricalHeatmapResponse>("/api/heatmap/historical"),
  
  getPredictedHeatmap: (hour: number, dayOfWeek: number) => 
    request<ZoneFeatureCollection>(`/api/heatmap/predicted?hour=${hour}&day_of_week=${dayOfWeek}`),
  
  predictSingle: (body: PredictRequest) => 
    request<PredictResponse>("/api/predict", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    
  verifyAuthToken: (idToken: string) => 
    request<UserSession>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    }),
    
  logout: (idToken: string) => 
    request<{ status: string; message: string }>("/api/auth/logout", {
      method: "POST",
    }, idToken),
    
  registerFCMToken: (idToken: string, fcmToken: string) => 
    request<{ status: string; message: string }>("/api/register-fcm-token", {
      method: "POST",
      body: JSON.stringify({ fcm_token: fcmToken }),
    }, idToken),
};
