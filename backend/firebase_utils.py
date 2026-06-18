"""
Firebase Admin SDK initialization and JWT verification dependency.
"""
import os

import firebase_admin  # pyrefly: ignore[missing-import]
from firebase_admin import auth, credentials, firestore  # pyrefly: ignore[missing-import]
from fastapi import Header, HTTPException, Depends

# ── Firebase Admin init ─────────────────────────────────────

_firebase_app = None
_firestore_client = None

# Service account key path (relative to project root)
_SA_KEY_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "firebase-service-account.json",
)


def _init_firebase():
    """Initialize Firebase Admin SDK (idempotent)."""
    global _firebase_app
    if _firebase_app is not None:
        return

    if not os.path.exists(_SA_KEY_PATH):
        raise RuntimeError(f"Firebase service account key not found: {_SA_KEY_PATH}")

    cred = credentials.Certificate(_SA_KEY_PATH)
    _firebase_app = firebase_admin.initialize_app(cred)
    print(f"[Firebase] Admin SDK initialized for project: {cred.project_id}")


def get_firestore_client():
    """Return a Firestore client (lazy-initialized)."""
    global _firestore_client
    _init_firebase()
    if _firestore_client is None:
        _firestore_client = firestore.client()
    return _firestore_client


# ── JWT verification dependency ─────────────────────────────

async def verify_firebase_token(authorization: str = Header(...)) -> dict:
    """
    FastAPI dependency that extracts and verifies a Firebase ID token
    from the Authorization header (Bearer <token>).

    Returns the decoded token dict with uid, email, etc.
    Raises 401 if token is missing or invalid.
    """
    _init_firebase()

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authorization header must be: Bearer <id_token>",
        )

    id_token = authorization.split("Bearer ", 1)[1].strip()
    if not id_token:
        raise HTTPException(status_code=401, detail="Empty token")

    try:
        decoded = auth.verify_id_token(id_token)
        return decoded
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")
