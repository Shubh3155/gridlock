"""
Session management via Firestore.

Each authenticated user gets a server-side session stored in the 'sessions' collection.
Sessions have a 24-hour TTL and are validated on protected routes.
"""
import uuid
from datetime import datetime, timedelta, timezone

from firebase_utils import get_firestore_client

SESSION_TTL_HOURS = 24
_COLLECTION = "sessions"


def create_session(uid: str, email: str = None, display_name: str = None) -> str:
    """
    Create a new session for the user. Overwrites any existing session for this uid.
    Returns the session_id.
    """
    db = get_firestore_client()
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    session_doc = {
        "session_id": session_id,
        "uid": uid,
        "email": email,
        "display_name": display_name,
        "created_at": now,
        "last_active": now,
        "expires_at": now + timedelta(hours=SESSION_TTL_HOURS),
    }

    # Use uid as document ID so each user has exactly one session
    db.collection(_COLLECTION).document(uid).set(session_doc)
    return session_id


def validate_session(uid: str, session_id: str) -> bool:
    """
    Check if a session exists for the given uid and is not expired.
    Also updates last_active timestamp.
    """
    db = get_firestore_client()
    doc_ref = db.collection(_COLLECTION).document(uid)
    doc = doc_ref.get()

    if not doc.exists:
        return False

    data = doc.to_dict()
    if data.get("session_id") != session_id:
        return False

    # Check expiry
    expires_at = data.get("expires_at")
    if expires_at:
        # Firestore returns timezone-aware datetimes
        now = datetime.now(timezone.utc)
        if hasattr(expires_at, "timestamp"):
            # Firestore DatetimeWithNanoseconds
            if now.timestamp() > expires_at.timestamp():
                # Session expired — clean up
                doc_ref.delete()
                return False

    # Touch last_active
    doc_ref.update({"last_active": datetime.now(timezone.utc)})
    return True


def end_session(uid: str):
    """Delete the session document for this user."""
    db = get_firestore_client()
    db.collection(_COLLECTION).document(uid).delete()


def get_session(uid: str) -> dict | None:
    """Get session data for a user, or None if no active session."""
    db = get_firestore_client()
    doc = db.collection(_COLLECTION).document(uid).get()
    if doc.exists:
        return doc.to_dict()
    return None
