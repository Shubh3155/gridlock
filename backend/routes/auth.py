"""
Auth routes — Firebase token verification, session management, FCM token registration.
"""
from fastapi import APIRouter, Depends, HTTPException

from schemas import TokenVerifyRequest, SessionResponse, FCMTokenRequest
from firebase_utils import verify_firebase_token, get_firestore_client
from session_manager import create_session, end_session

router = APIRouter(prefix="/api", tags=["Auth"])


@router.post("/auth/verify", response_model=SessionResponse)
async def verify_and_create_session(body: TokenVerifyRequest):
    """
    Verify a Firebase ID token (sent from the frontend after Google sign-in)
    and create a server-side session.

    Returns session_id + user info.
    """
    from firebase_admin import auth

    try:
        decoded = auth.verify_id_token(body.id_token)
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

    uid = decoded["uid"]
    email = decoded.get("email")
    display_name = decoded.get("name")

    # Create server-side session
    session_id = create_session(uid=uid, email=email, display_name=display_name)

    return SessionResponse(
        session_id=session_id,
        uid=uid,
        email=email,
        display_name=display_name,
    )


@router.post("/auth/logout")
async def logout(user: dict = Depends(verify_firebase_token)):
    """
    End the server-side session for the authenticated user.
    Requires valid Bearer token in Authorization header.
    """
    uid = user["uid"]
    end_session(uid)
    return {"status": "ok", "message": "Session ended"}


@router.post("/register-fcm-token")
async def register_fcm_token(
    body: FCMTokenRequest,
    user: dict = Depends(verify_firebase_token),
):
    """
    Store the user's FCM token in Firestore for push notifications.
    Requires valid Bearer token in Authorization header.
    Assigns the operator to the highest violation area's police station.
    """
    uid = user["uid"]
    db = get_firestore_client()

    # Dynamically find the highest violation area's police station
    import data_loader
    geojson = data_loader.get_zones_geojson()
    features = geojson.get("features", [])
    highest_station = "Upparpet"
    if features:
        highest_zone = max(features, key=lambda f: f.get("properties", {}).get("violation_count", 0))
        highest_station = highest_zone.get("properties", {}).get("police_station", "Upparpet")

    # Store/update FCM token and station in the users collection
    db.collection("users").document(uid).set(
        {
            "uid": uid,
            "email": user.get("email"),
            "fcm_token": body.fcm_token,
            "role": "enforcer",  # default role
            "police_station": highest_station,
        },
        merge=True,
    )

    return {
        "status": "ok",
        "message": f"FCM token registered. Operator assigned to {highest_station} sector."
    }


@router.post("/alert/dispatch")
async def dispatch_alert(
    user: dict = Depends(verify_firebase_token),
    db = Depends(get_firestore_client),
):
    """
    Find the highest violation area (zone with max violation_count).
    Query all operators in Firestore assigned to this area's police station.
    Send a multicast FCM push notification to all their active devices.
    """
    from firebase_admin import messaging
    import data_loader

    # 1. Find the highest violation area
    geojson = data_loader.get_zones_geojson()
    features = geojson.get("features", [])
    if not features:
        raise HTTPException(status_code=404, detail="No violation areas available in GeoJSON data.")

    highest_zone = max(features, key=lambda f: f.get("properties", {}).get("violation_count", 0))
    properties = highest_zone.get("properties", {})
    zone_id = properties.get("zone_id", "Unknown")
    police_station = properties.get("police_station", "Unknown")
    violation_count = properties.get("violation_count", 0)
    priority_score = properties.get("priority_score", 0.0)

    # 2. Query Firestore for all users assigned to this police station
    query = db.collection("users").where("police_station", "==", police_station).stream()
    
    tokens = []
    for doc in query:
        doc_data = doc.to_dict()
        fcm_token = doc_data.get("fcm_token")
        if fcm_token:
            tokens.append(fcm_token)

    if not tokens:
        return {
            "status": "warning",
            "message": f"No active operators registered under the {police_station} sector.",
            "zone_id": zone_id,
            "police_station": police_station,
            "success_count": 0,
            "failure_count": 0
        }

    # 3. Construct multicast message and send via Firebase Cloud Messaging
    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title="🚨 HIGH INFRACTION ALERT",
            body=f"{police_station} has critical activity: {violation_count} violations detected (Score: {priority_score}/10)",
        ),
        data={
            "zone_id": zone_id,
            "police_station": police_station,
            "violation_count": str(violation_count),
            "priority_score": str(priority_score)
        },
        tokens=tokens,
    )

    try:
        response = messaging.send_each_for_multicast(message)
        success_count = response.success_count
        failure_count = response.failure_count
        
        # Log to server console
        print(f"[FCM] Dispatched alert to {success_count} operators. {failure_count} failed.")
        
        return {
            "status": "ok",
            "message": f"Alert successfully dispatched to {success_count} operators in {police_station}.",
            "zone_id": zone_id,
            "police_station": police_station,
            "success_count": success_count,
            "failure_count": failure_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"FCM multicast dispatch failed: {str(e)}"
        )

