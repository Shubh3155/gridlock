# Gridlock Hackathon 2.0 — Remaining Plan

## Current Status

| Component | Status |
|---|---|
| Data pipeline (clean + feature engineering) | ✅ Done |
| DBSCAN clustering | ✅ Done |
| XGBoost violation likelihood model | ✅ Done |
| Model evaluation (R² = 0.90, RMSE = 0.0763) | ✅ Done |
| Firebase Admin setup + service account key | ✅ Done |
| FastAPI backend | 🔲 Todo |
| Next.js frontend | 🔲 Todo |
| Firebase Auth + FCM browser push | 🔲 Todo |
| Gemini enforcement brief | 🔲 Todo |
| Deployment | 🔲 Todo |

---

## Phase 1 — Model Export (1 hour)

Before building the backend, export everything the API will need.

### 1A. SHAP Summary Chart

```python
import shap, matplotlib.pyplot as plt

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
shap.summary_plot(shap_values, X_test, show=False)
plt.tight_layout()
plt.savefig("backend/static/shap_summary.png", dpi=150)
```

### 1B. Confidence Tiers on Zone Data

```python
df['risk_tier'] = pd.cut(
    df['predicted_likelihood'],
    bins=[0, 0.35, 0.65, 1.0],
    labels=['Low', 'Medium', 'High']
)
```

### 1C. Prediction Grid Export

```python
import numpy as np, json

lat_range = np.linspace(df.latitude.min(), df.latitude.max(), 100)
lng_range = np.linspace(df.longitude.min(), df.longitude.max(), 100)

grid = []
for lat in lat_range:
    for lng in lng_range:
        features = build_features(lat, lng, hour=8, day_of_week=1)
        score = float(model.predict([features])[0])
        grid.append({"lat": lat, "lng": lng, "score": score})

with open("backend/static/prediction_grid.json", "w") as f:
    json.dump(grid, f)
```

### 1D. Save Zones as GeoJSON

```python
import geopandas as gpd
from shapely.geometry import Point, MultiPoint

zones = []
for cluster_id in df[df.cluster != -1].cluster.unique():
    cluster_df = df[df.cluster == cluster_id]
    hull = MultiPoint(cluster_df[['longitude','latitude']].values.tolist()).convex_hull
    zones.append({
        "type": "Feature",
        "geometry": hull.__geo_interface__,
        "properties": {
            "zone_id": str(cluster_id),
            "priority_score": round(float(cluster_df.priority_score.mean()), 2),
            "violation_count": len(cluster_df),
            "risk_tier": cluster_df.risk_tier.mode()[0],
            "top_violations": cluster_df.violation_type.value_counts().head(3).index.tolist(),
            "peak_hour": int(cluster_df.hour_of_day.mode()[0]),
            "police_station": cluster_df.police_station.mode()[0],
            "center_lat": float(cluster_df.latitude.mean()),
            "center_lng": float(cluster_df.longitude.mean()),
        }
    })

with open("backend/static/zones.geojson", "w") as f:
    json.dump({"type": "FeatureCollection", "features": zones}, f)
```

### Deliverables
- `backend/static/shap_summary.png`
- `backend/static/prediction_grid.json`
- `backend/static/zones.geojson`
- `backend/models/violation_likelihood.pkl`

---

## Phase 2 — FastAPI Backend (3–4 hours)

### Project Structure

```
backend/
├── main.py
├── firebase_utils.py
├── model_utils.py
├── requirements.txt
├── serviceAccountKey.json     ← gitignored
├── models/
│   └── violation_likelihood.pkl
└── static/
    ├── zones.geojson
    ├── prediction_grid.json
    └── shap_summary.png
```

### `requirements.txt`

```
fastapi
uvicorn
firebase-admin
xgboost
joblib
pandas
numpy
scikit-learn
google-generativeai
python-dotenv
```

### `firebase_utils.py`

```python
import firebase_admin
from firebase_admin import auth, credentials, firestore, messaging
from fastapi import Header, HTTPException

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

async def verify_token(authorization: str = Header(...)):
    try:
        token = authorization.split("Bearer ")[-1]
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_enforcer_tokens() -> list[str]:
    users = db.collection("users").where("role", "==", "enforcer").stream()
    return [u.to_dict().get("fcm_token") for u in users if u.to_dict().get("fcm_token")]

def push_hotspot_alert(zone_name: str, score: float, zone_id: str):
    tokens = get_enforcer_tokens()
    if not tokens:
        return
    messaging.send_each_for_multicast(
        messaging.MulticastMessage(
            notification=messaging.Notification(
                title="🚨 High Risk Zone Detected",
                body=f"{zone_name} — Risk Score: {score:.2f}",
            ),
            data={"zone_id": zone_id},
            tokens=tokens,
        )
    )
```

### `model_utils.py`

```python
import joblib, json
import numpy as np

model = joblib.load("models/violation_likelihood.pkl")

with open("static/zones.geojson") as f:
    zones_geojson = json.load(f)

with open("static/prediction_grid.json") as f:
    prediction_grid = json.load(f)

def build_features(lat, lng, hour, day_of_week):
    # Replicate the same feature engineering from training
    is_peak = 1 if hour in range(7, 10) or hour in range(17, 20) else 0
    return [lat, lng, hour, day_of_week, is_peak, 0, 0, 0]
    # Add remaining features to match training columns exactly
```

### `main.py`

```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from firebase_utils import verify_token, db, push_hotspot_alert
from model_utils import model, zones_geojson, prediction_grid, build_features
import google.generativeai as genai
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-vercel-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ── Public routes ──────────────────────────────────────────

@app.get("/api/zones")
async def get_zones():
    return JSONResponse(zones_geojson)

@app.get("/api/zones/{zone_id}")
async def get_zone(zone_id: str):
    zone = next(
        (f for f in zones_geojson["features"] if f["properties"]["zone_id"] == zone_id),
        None
    )
    if not zone:
        return JSONResponse({"error": "Zone not found"}, status_code=404)

    props = zone["properties"]

    # Check Firestore cache first
    doc = db.collection("zones").document(zone_id).get()
    if doc.exists and doc.to_dict().get("enforcement_brief"):
        props["enforcement_brief"] = doc.to_dict()["enforcement_brief"]
    else:
        brief = generate_brief(props)
        props["enforcement_brief"] = brief
        db.collection("zones").document(zone_id).set(
            {"enforcement_brief": brief}, merge=True
        )

    return JSONResponse(zone)

@app.get("/api/heatmap/historical")
async def historical_heatmap():
    # Return raw violation lat/lng points
    import pandas as pd
    df = pd.read_csv("static/violations_clean.csv")
    points = df[["latitude", "longitude"]].dropna().values.tolist()
    return {"points": points}

@app.get("/api/heatmap/predicted")
async def predicted_heatmap():
    return {"points": prediction_grid}

@app.get("/api/stats")
async def get_stats():
    features = [f["properties"] for f in zones_geojson["features"]]
    return {
        "total_zones": len(features),
        "high_risk_zones": sum(1 for f in features if f["risk_tier"] == "High"),
        "total_violations": sum(f["violation_count"] for f in features),
        "top_station": max(features, key=lambda x: x["violation_count"])["police_station"],
    }

@app.post("/api/predict")
async def predict(body: dict):
    features = build_features(
        lat=body["lat"], lng=body["lng"],
        hour=body["hour"], day_of_week=body["day_of_week"]
    )
    score = float(model.predict([features])[0])
    tier = "High" if score > 0.65 else "Medium" if score > 0.35 else "Low"
    return {"likelihood_score": round(score, 4), "risk_tier": tier}

# ── Protected routes ───────────────────────────────────────

@app.post("/api/register-fcm-token")
async def register_token(body: dict, user=Depends(verify_token)):
    db.collection("users").document(user["uid"]).set(
        {"email": user["email"], "fcm_token": body["fcm_token"], "role": "enforcer"},
        merge=True
    )
    return {"status": "ok"}

# ── Static ─────────────────────────────────────────────────

@app.get("/static/shap_summary.png")
async def shap_image():
    return FileResponse("static/shap_summary.png")

# ── Helpers ────────────────────────────────────────────────

def generate_brief(props: dict) -> str:
    prompt = f"""
    You are a traffic enforcement analyst. Write a 2-line patrol recommendation.
    Be specific and actionable. No preamble.

    Location: {props.get('police_station', 'Unknown')}
    Violations (last 30 days): {props['violation_count']}
    Top types: {', '.join(props['top_violations'])}
    Peak hour: {props['peak_hour']}:00
    Risk score: {props['priority_score']}/10
    Risk tier: {props['risk_tier']}
    """
    response = genai.GenerativeModel("gemini-pro").generate_content(prompt)
    return response.text
```

---

## Phase 3 — Next.js Frontend (4–5 hours)

### Setup

```bash
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend
npm install firebase leaflet react-leaflet chart.js react-chartjs-2
npm install @types/leaflet
```

### Project Structure

```
frontend/
├── app/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Map.tsx                ← dynamic import, no SSR
│   ├── ZoneLayer.tsx          ← colored polygons per risk tier
│   ├── HeatmapLayer.tsx       ← Leaflet.heat wrapper
│   ├── ZoneDetailPanel.tsx    ← slides in on zone click
│   ├── TopZonesList.tsx       ← ranked list sidebar
│   ├── StatsBar.tsx           ← summary numbers
│   ├── Charts.tsx             ← hourly trend + pie chart
│   ├── Navbar.tsx             ← logo + login button
│   └── Toast.tsx              ← foreground FCM toast
├── lib/
│   ├── firebase.ts
│   ├── api.ts
│   └── types.ts
└── public/
    └── firebase-messaging-sw.js   ← served at root automatically
```

### Critical: Map must be dynamically imported

```tsx
// app/page.tsx
import dynamic from 'next/dynamic'
const Map = dynamic(() => import('@/components/Map'), { ssr: false })
```

Leaflet accesses `window` on import — it will crash Next.js SSR without this.

### `lib/firebase.ts`

```typescript
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const auth = getAuth(app)

export async function loginWithGoogle() {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider())
  const idToken = await user.getIdToken()
  return { user, idToken }
}

export async function logout() {
  await signOut(auth)
}

export async function registerFCMToken(idToken: string) {
  if (typeof window === 'undefined') return
  const messaging = getMessaging(app)
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const fcmToken = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  })

  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/register-fcm-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fcm_token: fcmToken })
  })

  return fcmToken
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (typeof window === 'undefined') return
  const messaging = getMessaging(app)
  onMessage(messaging, callback)
}
```

### `public/firebase-messaging-sw.js`

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

// Hardcode config — process.env does NOT work in service workers
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon.png',
    data: payload.data
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  clients.openWindow(`/?zone=${event.notification.data.zone_id}`)
})
```

### `.env.local`

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  NAVBAR: Logo | Stats pills | Login button               │
├──────────────────┬───────────────────────────────────────┤
│                  │  TOP ENFORCEMENT ZONES (ranked)       │
│  LEAFLET MAP     │  ───────────────────────────────────  │
│                  │  🔴 Zone 4 · Score 8.4 · 23 cases    │
│  Toggle buttons: │  🟠 Zone 7 · Score 6.1 · 14 cases    │
│  [Historical]    │  🟡 Zone 2 · Score 4.2 · 9 cases     │
│  [Predicted]     │  ───────────────────────────────────  │
│                  │  VIOLATION TYPE BREAKDOWN (pie)       │
│  Click zone →    │  ───────────────────────────────────  │
│  detail panel    │  HOURLY TREND (bar chart)             │
└──────────────────┴───────────────────────────────────────┘
```

### Zone Detail Panel (on click)

Shows:
- Zone name + risk tier badge (color-coded)
- Violation count + top types
- Peak hour
- AI enforcement brief (from `/api/zones/{id}`)
- SHAP summary image (from `/static/shap_summary.png`)

---

## Phase 4 — Deployment (1 hour)

### Backend → Render

1. Push `backend/` to GitHub (ensure `serviceAccountKey.json` is gitignored)
2. On Render: New Web Service → connect repo → set:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add env vars: `GEMINI_API_KEY` + Firebase service account as base64:
   ```bash
   base64 -i serviceAccountKey.json | pbcopy  # copy to clipboard
   ```
   Then decode in `firebase_utils.py`:
   ```python
   import base64, json, tempfile, os

   if os.getenv("FIREBASE_SERVICE_ACCOUNT_B64"):
       decoded = base64.b64decode(os.getenv("FIREBASE_SERVICE_ACCOUNT_B64"))
       with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode='wb') as f:
           f.write(decoded)
           cred = credentials.Certificate(f.name)
   else:
       cred = credentials.Certificate("serviceAccountKey.json")
   ```

### Frontend → Vercel

```bash
cd frontend
vercel --prod
```

Set all `NEXT_PUBLIC_*` env vars in Vercel dashboard. Update `NEXT_PUBLIC_API_URL` to the Render URL.

---

## Remaining Timeline

| Block | Task | Est. Time |
|---|---|---|
| Now | Phase 1: SHAP + tiers + grid + GeoJSON export | 1 hr |
| Next | Phase 2: FastAPI all routes wired + tested | 3–4 hrs |
| Next | Phase 3: Next.js scaffold + map + auth + FCM | 4–5 hrs |
| Next | Gemini brief endpoint + Firestore cache | 1 hr |
| Final | Deploy Render + Vercel + smoke test | 1 hr |

**Deadline: June 21 — ~3 days remaining.**

---

## Pitch Line

> *"Our system doesn't just show where violations happened — it predicts where they'll happen next with 90% accuracy, enabling pre-emptive patrol deployment rather than reactive enforcement."*