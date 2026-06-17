# Gridlock Hackathon 2.0 — Parking Intelligence Webapp
## Full Plan of Action

---

## Problem Statement (PS1)

**Poor Visibility on Parking-Induced Congestion**

On-street illegal parking and spillover parking near commercial areas, metro stations, and events choke carriageways and intersections. Enforcement is patrol-based and reactive, with no heatmap of parking violations vs. congestion impact and no way to prioritize enforcement zones.

**Goal:** AI-driven parking intelligence that detects illegal parking hotspots, quantifies their impact on traffic flow, and enables targeted enforcement.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Data processing | Python, pandas, scikit-learn (DBSCAN) |
| Backend | FastAPI |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Firebase Firestore |
| Push notifications | Firebase Cloud Messaging (FCM) — browser push |
| Map visualization | Leaflet.js + Heatmap.js |
| Charts | Chart.js |
| LLM enforcement brief | Gemini API |
| Deployment | Render / Hugging Face Spaces |

---

## Phase 1 — Data Pipeline

**Goal:** Clean, parse, and feature-engineer the violation dataset into a format ready for clustering and scoring.

### Tasks

- Load CSV and filter only `validation_status = approved` rows
- Parse `violation_type` and `offence_code` JSON arrays into flat columns
- Extract temporal features: hour of day, day of week from `created_datetime`
- Derive violation type weights:
  - `PARKING IN A MAIN ROAD` → weight 1.0
  - `WRONG PARKING` → weight 0.75
  - `PARKING NEAR ROAD CROSSING` → weight 0.85
  - `NO PARKING` → weight 0.6
- Flag junction proximity: zones marked `junction_name != "No Junction"` get a 1.2x multiplier
- Output: cleaned DataFrame saved as `violations_clean.csv`

### Deliverable
`pipeline/clean.py` — standalone script, runs on the raw CSV

---

## Phase 2 — Core Intelligence Layer

**Goal:** Cluster violations into hotspot zones and compute an enforcement priority score per zone.

### Hotspot Detection (DBSCAN)

Use DBSCAN clustering on `(latitude, longitude)` — no fixed grid, adapts to data density naturally.

```python
from sklearn.cluster import DBSCAN
import numpy as np

coords = df[['latitude', 'longitude']].values
coords_rad = np.radians(coords)
db = DBSCAN(eps=0.0003, min_samples=3, metric='haversine').fit(coords_rad)
df['cluster'] = db.labels_
```

Tune `eps` based on the dataset density (~50–100m radius).

### Priority Score Formula

For each cluster:

```
priority_score = (violation_count × avg_violation_weight × time_multiplier × junction_multiplier)
```

- `time_multiplier`: peak hours (7–10am, 5–8pm) → 1.3x, otherwise 1.0x
- `junction_multiplier`: 1.2x if any violation in cluster is near a junction

### Output per Zone

```json
{
  "zone_id": "cluster_4",
  "center": { "lat": 12.925, "lng": 77.618 },
  "priority_score": 8.4,
  "violation_count": 23,
  "top_violations": ["WRONG PARKING", "PARKING IN A MAIN ROAD"],
  "peak_hour": "08:00",
  "police_station": "Madiwala",
  "last_updated": "2023-11-28T04:48:00Z"
}
```

### Deliverable
`pipeline/cluster.py` — outputs `zones.geojson` served by FastAPI

---

## Phase 3 — Backend (FastAPI)

**Goal:** REST API serving zone data, handling auth, storing FCM tokens, and triggering push notifications.

### Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/zones` | All computed zones as GeoJSON |
| GET | `/api/zones/{zone_id}` | Single zone detail |
| GET | `/api/stats` | Dashboard summary stats |
| POST | `/api/register-fcm-token` | Store FCM token for logged-in user |
| POST | `/api/run-pipeline` | (Admin) Re-run clustering on new data |

### Auth Middleware

```python
import firebase_admin
from firebase_admin import auth, credentials

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

async def verify_token(authorization: str = Header(...)):
    token = authorization.split("Bearer ")[-1]
    decoded = auth.verify_id_token(token)
    return decoded  # uid, email, role
```

### FCM Token Registration

```python
@app.post("/api/register-fcm-token")
async def register_token(body: dict, user=Depends(verify_token)):
    db.collection("users").document(user["uid"]).set(
        {"fcm_token": body["fcm_token"], "role": "enforcer"},
        merge=True
    )
    return {"status": "ok"}
```

### Push Notification Trigger

Called at end of clustering pipeline when `priority_score > threshold` (default: 7.0).

```python
from firebase_admin import messaging

def push_hotspot_alert(zone_name: str, score: float, zone_id: str):
    tokens = get_all_enforcer_tokens()
    if not tokens:
        return
    messaging.send_each_for_multicast(
        messaging.MulticastMessage(
            notification=messaging.Notification(
                title="🚨 High Priority Zone Detected",
                body=f"{zone_name} — Priority Score: {score:.1f}",
            ),
            data={"zone_id": zone_id},
            tokens=tokens,
        )
    )
```

### Deliverable
`backend/main.py` + `backend/firebase_utils.py`

---

## Phase 4 — Frontend (Map Dashboard)

**Goal:** Interactive web dashboard showing violation heatmap, priority zones, and enforcement stats.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  NAVBAR: Logo | City | Auth status | Notification bell│
├───────────────────────┬─────────────────────────────┤
│                       │  TOP ZONES (ranked list)    │
│   LEAFLET MAP         │  ─────────────────────────  │
│   - Heatmap layer     │  1. Koramangala 2nd Block   │
│   - Priority zones    │     Score: 8.4 | 23 cases   │
│     (color-coded)     │  2. Sarjapura Main Road     │
│   - Click zone →      │     Score: 6.1 | 14 cases   │
│     detail panel      │  ─────────────────────────  │
│                       │  VIOLATION TYPE BREAKDOWN   │
│                       │  (pie chart)                │
├───────────────────────┴─────────────────────────────┤
│  HOURLY TREND (bar chart) | POLICE STATION LOAD     │
└─────────────────────────────────────────────────────┘
```

### Map Layers

- **Heatmap layer** — all violations, intensity by density (Leaflet.heat)
- **Zone polygons** — convex hull around each cluster, color-coded:
  - Red: score > 8
  - Orange: score 5–8
  - Yellow: score < 5
- **Click zone** → right panel shows zone detail + AI enforcement brief

### Files

- `frontend/index.html` — main dashboard
- `frontend/firebase-messaging-sw.js` — service worker at root (required for FCM)
- `frontend/firebase.js` — auth + FCM token registration
- `frontend/map.js` — Leaflet map, heatmap, zone polygons
- `frontend/charts.js` — Chart.js panels

---

## Phase 5 — Firebase Integration (Auth + Push)

**Goal:** Google login for enforcers/admins, browser push notifications for high-priority zone alerts.

### Firebase Auth (Google Sign-In)

```javascript
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

async function login() {
  const { user } = await signInWithPopup(auth, provider);
  const idToken = await user.getIdToken();

  // Register FCM token after login
  const fcmToken = await requestNotificationPermission();
  if (fcmToken) {
    await fetch('/api/register-fcm-token', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcm_token: fcmToken })
    });
  }
}
```

### Browser Push (FCM)

**`firebase-messaging-sw.js`** — must be served at `/firebase-messaging-sw.js` (root path, not `/static/`):

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({ /* config */ });
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon.png',
    data: payload.data
  });
});

// Clicking notification → open app focused on that zone
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  clients.openWindow(`/?zone=${event.notification.data.zone_id}`);
});
```

### FastAPI — Serve Service Worker at Root

```python
from fastapi.responses import FileResponse

@app.get("/firebase-messaging-sw.js")
async def serve_sw():
    return FileResponse("frontend/firebase-messaging-sw.js")
```

### Foreground Toast (App is Open)

```javascript
import { onMessage } from 'firebase/messaging';

onMessage(messaging, (payload) => {
  showToast({
    title: payload.notification.title,
    body: payload.notification.body,
    zoneId: payload.data.zone_id
  });
});
```

### Firestore Schema

```
users/{uid}
  - email: string
  - role: "enforcer" | "admin"
  - fcm_token: string

zones/{zone_id}        ← written by pipeline, read by dashboard
  - center: { lat, lng }
  - priority_score: float
  - violation_count: int
  - top_violation_types: []
  - police_station: string
  - last_updated: timestamp
```

---

## Phase 6 — AI Enforcement Brief (Gemini API)

**Goal:** Per-zone, auto-generated plain-English patrol recommendation shown in the detail panel.

### Prompt Template

```python
def generate_enforcement_brief(zone: dict) -> str:
    prompt = f"""
    You are a traffic enforcement analyst. Given the following zone data, write a 2-line
    patrol recommendation for police. Be specific and actionable. No preamble.

    Zone: {zone['location']}
    Violations: {zone['violation_count']} in last 30 days
    Top types: {', '.join(zone['top_violations'])}
    Peak hour: {zone['peak_hour']}
    Priority score: {zone['priority_score']}/10
    """
    response = genai.GenerativeModel("gemini-pro").generate_content(prompt)
    return response.text
```

### Example Output

> Zone 4 (Koramangala 2nd Block) records 23 main-road parking violations peaking at 08:00.
> Recommend morning patrol deployment (7–10am) at 18th Main Road intersection, prioritizing
> clearance of the primary carriageway.

---

## Demo Flow (Judges)

```
1. Open webapp → Google login prompt
2. "Allow notifications?" browser prompt appears          ← impressive
3. Dashboard loads → heatmap + ranked zone list
4. Clustering pipeline triggered → high-score zone found
5. Browser push notification fires (works in background)  ← very impressive
6. Click notification → app focuses, highlights zone on map
7. Click zone polygon → right panel shows:
   - violation breakdown
   - peak hour chart
   - AI-generated patrol brief                           ← differentiator
```

---

## Project Structure

```
gridlock/
├── backend/
│   ├── main.py
│   ├── firebase_utils.py
│   └── requirements.txt
├── pipeline/
│   ├── clean.py
│   ├── cluster.py
│   └── score.py
├── frontend/
│   ├── index.html
│   ├── firebase.js
│   ├── map.js
│   ├── charts.js
│   └── firebase-messaging-sw.js   ← served at root by FastAPI
├── data/
│   ├── violations_raw.csv
│   ├── violations_clean.csv
│   └── zones.geojson
├── serviceAccountKey.json         ← gitignored
└── .env                           ← GEMINI_API_KEY, FCM config
```


---

## Key Differentiator

Most teams will submit a map with pins. The edge here is:

1. **Ranked enforcement priority list** with an explainable score (not just a heatmap)
2. **Auto-generated patrol brief per zone** via Gemini (actionable, not just visual)
3. **Live browser push notifications** when new hotspots are detected (real-time feel)
4. **Role-based access** (enforcer vs admin) via Firebase Auth