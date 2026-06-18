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
    """
    uid = user["uid"]
    db = get_firestore_client()

    # Store/update FCM token in the users collection
    db.collection("users").document(uid).set(
        {
            "uid": uid,
            "email": user.get("email"),
            "fcm_token": body.fcm_token,
            "role": "enforcer",  # default role
        },
        merge=True,
    )

    return {"status": "ok", "message": "FCM token registered"}
