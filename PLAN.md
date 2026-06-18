# Gridlock Hackathon 2.0 — Remaining Plan
## (Model trained ✅ — what to do next)

---

## Current Status

| Component | Status |
|---|---|
| Data pipeline (clean + feature engineering) | ✅ Done |
| DBSCAN clustering | ✅ Done |
| XGBoost violation likelihood model | ✅ Done |
| Model evaluation (R² = 0.90, RMSE = 0.0763) | ✅ Done |
| FastAPI backend | ✅ Done |
| Next.js frontend | 🔲 Todo |
| Firebase Auth (backend JWT verify + sessions) | ✅ Done |
| FCM browser push (frontend integration) | 🔲 Todo |
| Gemini enforcement brief | 🔲 Todo |
| Deployment | 🔲 Todo |

---

## Phase 1 — Model Finalization (1–2 hours)

Before wiring into the backend, finish two things that are demo/judge-critical.

### 1A. SHAP Explainability

```python
import shap
import matplotlib.pyplot as plt

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# Summary plot — save as image for frontend
shap.summary_plot(shap_values, X_test, show=False)
plt.tight_layout()
plt.savefig("static/shap_summary.png", dpi=150)
```

Put this chart on the dashboard. Judges will ask "why does your model predict high risk here?" — SHAP answers it visually.

### 1B. Confidence Tiers

Bucket raw predictions into three actionable tiers:

```python
df['risk_tier'] = pd.cut(
    df['predicted_likelihood'],
    bins=[0, 0.35, 0.65, 1.0],
    labels=['Low', 'Medium', 'High']
)
```

These tiers drive map colors (green / orange / red) and the enforcement priority list.

### 1C. Prediction Grid Export

Generate a prediction grid over the full bounding box for the heatmap layer:

```python
import numpy as np
import json

lat_range = np.linspace(df.latitude.min(), df.latitude.max(), 100)
lng_range = np.linspace(df.longitude.min(), df.longitude.max(), 100)

grid_points = []
for lat in lat_range:
    for lng in lng_range:
        features = build_features(lat, lng, hour=8, day_of_week=1)
        score = float(model.predict([features])[0])
        grid_points.append({"lat": lat, "lng": lng, "score": score})

with open("static/prediction_grid.json", "w") as f:
    json.dump(grid_points, f)
```

Expose this as a FastAPI endpoint so the frontend can toggle between historical heatmap and predicted heatmap.

### Deliverables
- `pipeline/model_export.py` — runs SHAP + grid export
- `models/violation_likelihood.pkl` — saved model
- `static/prediction_grid.json` — precomputed grid
- `static/shap_summary.png` — explainability chart

---

## Phase 2 — FastAPI Backend (3–4 hours)

### Project Structure

```
backend/
├── main.py
├── firebase_utils.py
├── cluster_utils.py
├── model_utils.py
├── requirements.txt
└── models/
    └── violation_likelihood.pkl
```

### Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/zones` | Public | All DBSCAN zones as GeoJSON with priority scores |
| GET | `/api/zones/{zone_id}` | Public | Single zone detail + AI brief |
| GET | `/api/heatmap/historical` | Public | Raw violation points for heatmap |
| GET | `/api/heatmap/predicted` | Public | Precomputed prediction grid |
| GET | `/api/stats` | Public | Dashboard summary (total violations, top station, peak hour) |
| POST | `/api/predict` | Public | Predict likelihood for a given lat/lng/hour/day |
| POST | `/api/register-fcm-token` | 🔒 JWT | Store FCM token for logged-in user |
| POST | `/api/run-pipeline` | 🔒 Admin | Re-run clustering + model inference on new data |

### Auth Middleware

```python
import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Header, HTTPException

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

async def verify_token(authorization: str = Header(...)):
    try:
        token = authorization.split("Bearer ")[-1]
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### Model Inference Endpoint

```python
import joblib
import numpy as np

model = joblib.load("models/violation_likelihood.pkl")

@app.post("/api/predict")
async def predict_likelihood(body: dict):
    features = build_features(
        lat=body["lat"],
        lng=body["lng"],
        hour=body["hour"],
        day_of_week=body["day_of_week"]
    )
    score = float(model.predict([features])[0])
    tier = "High" if score > 0.65 else "Medium" if score > 0.35 else "Low"
    return {"likelihood_score": score, "risk_tier": tier}
```

### FCM Push on High-Score Zone Detection

```python
from firebase_admin import messaging, firestore

db = firestore.client()

def get_enforcer_tokens():
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

### CORS (required for Next.js dev)

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-prod-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Service Worker Route (FCM requirement)

```python
from fastapi.responses import FileResponse

@app.get("/firebase-messaging-sw.js")
async def serve_sw():
    return FileResponse("frontend/public/firebase-messaging-sw.js")
```

> ⚠️ The service worker **must** be served from the root path. In Next.js, place it in `/public/firebase-messaging-sw.js` — Next.js serves `/public` at root automatically, so FastAPI doesn't need to serve it in production.

---

## Phase 3 — Next.js Frontend (4–5 hours)

### Project Setup

```bash
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend
npm install firebase leaflet react-leaflet leaflet.heat chart.js react-chartjs-2
npm install @types/leaflet
```

### Project Structure

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               ← dashboard (map + panels)
│   └── api/                   ← Next.js API routes (optional proxies)
├── components/
│   ├── Map.tsx                ← Leaflet map, dynamic import (no SSR)
│   ├── HeatmapLayer.tsx       ← Leaflet.heat integration
│   ├── ZoneLayer.tsx          ← DBSCAN zone polygons, color-coded
│   ├── ZoneDetailPanel.tsx    ← right panel on zone click
│   ├── TopZonesList.tsx       ← ranked enforcement list
│   ├── StatsBar.tsx           ← summary numbers top bar
│   ├── Charts.tsx             ← hourly trend + violation type pie
│   ├── Navbar.tsx             ← logo + auth status + notification bell
│   └── Toast.tsx              ← foreground FCM notification toast
├── lib/
│   ├── firebase.ts            ← firebase init + auth + FCM
│   ├── api.ts                 ← typed fetch wrappers for FastAPI
│   └── types.ts               ← Zone, Violation, PredictionPoint types
└── public/
    └── firebase-messaging-sw.js   ← FCM service worker (served at root)
```

### Key Implementation Notes

#### Map must be dynamically imported (no SSR)

Leaflet breaks on server-side render. Always:

```tsx
// app/page.tsx
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })
```

#### Firebase init (`lib/firebase.ts`)

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
})

export const auth = getAuth(app)

export async function loginWithGoogle() {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider())
  const idToken = await user.getIdToken()
  return { user, idToken }
}

export async function registerFCMToken(idToken: string) {
  // Only runs in browser
  if (typeof window === 'undefined') return
  const messaging = getMessaging(app)
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

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
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (typeof window === 'undefined') return
  const messaging = getMessaging(app)
  onMessage(messaging, callback)
}
```

#### Service Worker (`public/firebase-messaging-sw.js`)

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  messagingSenderId: "...",
  appId: "..."
  // Hardcode here — env vars are not available in service workers
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

> ⚠️ Firebase config must be hardcoded in the service worker. `process.env` does not work inside service workers.

#### Dashboard Layout (`app/page.tsx`)

```tsx
export default function Dashboard() {
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <Navbar />
      <StatsBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <Map />                    {/* Leaflet map, fills left panel */}
        </div>
        <div className="w-80 flex flex-col border-l border-zinc-800 overflow-y-auto">
          <TopZonesList />           {/* ranked enforcement zones */}
          <Charts />                 {/* hourly trend + violation pie */}
        </div>
      </div>
      <Toast />                      {/* foreground FCM notification */}
    </div>
  )
}
```

#### Map Layers Toggle

Two layers on the map, toggled by a button:

```tsx
const [layer, setLayer] = useState<'historical' | 'predicted'>('historical')

// historical → fetch /api/heatmap/historical → Leaflet.heat
// predicted  → fetch /api/heatmap/predicted  → Leaflet.heat on prediction grid
```

This is the demo's visual centrepiece — switching from "where violations happened" to "where violations will happen."

#### Zone Click → Detail Panel

```tsx
// ZoneDetailPanel.tsx
// Shows on zone polygon click:
// - violation count + breakdown
// - risk tier badge (High / Medium / Low)
// - peak hour
// - AI enforcement brief (fetched from /api/zones/{id})
// - SHAP summary image
```

### Environment Variables (`.env.local`)

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Phase 4 — Gemini Enforcement Brief (1 hour)

Called server-side in FastAPI when `/api/zones/{zone_id}` is hit.

```python
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def generate_enforcement_brief(zone: dict) -> str:
    prompt = f"""
    You are a traffic enforcement analyst. Write a 2-line patrol recommendation.
    Be specific and actionable. No preamble.

    Location: {zone['location']}
    Violations (last 30 days): {zone['violation_count']}
    Top types: {', '.join(zone['top_violations'])}
    Peak hour: {zone['peak_hour']}
    Risk score: {zone['priority_score']:.2f}/10
    Risk tier: {zone['risk_tier']}
    """
    response = genai.GenerativeModel("gemini-pro").generate_content(prompt)
    return response.text
```

Cache the result in Firestore so it's not regenerated on every click:

```python
# Write to Firestore on first generation
db.collection("zones").document(zone_id).set(
    {"enforcement_brief": brief, "brief_generated_at": firestore.SERVER_TIMESTAMP},
    merge=True
)
```

---

## Phase 5 — Deployment (1 hour)

### Backend (Render)

```yaml
# render.yaml
services:
  - type: web
    name: gridlock-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Add `serviceAccountKey.json` content as a Render environment variable (base64 encoded).

### Frontend (Vercel)

```bash
cd frontend
vercel --prod
```

Set all `NEXT_PUBLIC_*` env vars in Vercel dashboard. Update `NEXT_PUBLIC_API_URL` to the Render backend URL.

---

## Demo Flow (Judges)

```
1. Open webapp → brutalist black/white dashboard loads
2. Google login → "Allow notifications?" browser prompt       ← impressive
3. Map shows historical violation heatmap (Bengaluru)
4. Toggle → predicted likelihood heatmap appears              ← wow moment
5. Click red high-risk zone → detail panel slides in:
   - violation breakdown
   - risk tier badge
   - AI patrol brief                                          ← differentiator
6. Admin triggers pipeline rerun → high-score zone found
7. Browser push notification fires (works in background)      ← very impressive
8. Click notification → app focuses, highlights that zone
```

---

## Remaining Timeline

| Time | Task |
|---|---|
| Next 1–2 hrs | Phase 1: SHAP + confidence tiers + prediction grid export |
| Next 3–4 hrs | Phase 2: FastAPI all routes + FCM push wired |
| Next 4–5 hrs | Phase 3: Next.js dashboard + map + Firebase Auth + FCM |
| Next 1 hr | Phase 4: Gemini brief endpoint + Firestore cache |
| Final 1 hr | Phase 5: Deploy to Render + Vercel, smoke test end-to-end |

---

## Pitch Line (one sentence)

> *"Our system doesn't just show where violations happened — it predicts where they'll happen next with 90% accuracy, enabling pre-emptive patrol deployment rather than reactive enforcement."*