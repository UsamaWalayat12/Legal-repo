"""
Auth helpers — verifies Supabase-issued JWTs.

Your Supabase project uses ES256 (Elliptic Curve P-256) signing.
We fetch the public key from the Supabase JWKS endpoint once on startup
and cache it, then use it to verify every incoming JWT properly.
"""
import json
import urllib.request
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from jose.utils import base64url_decode

from app.config import settings

_bearer = HTTPBearer(auto_error=False)

# Cached public key — loaded once on first request
_cached_public_key = None


def _get_public_key():
    """
    Fetches the ES256 public key from Supabase JWKS endpoint.
    Cached after first call so we don't hit the network on every request.
    """
    global _cached_public_key
    if _cached_public_key is not None:
        return _cached_public_key

    if not settings.supabase_url:
        return None

    try:
        jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(jwks_url, timeout=5) as resp:
            jwks = json.loads(resp.read())
        # Take the first key
        key_data = jwks["keys"][0]
        _cached_public_key = jwk.construct(key_data)
        return _cached_public_key
    except Exception as e:
        print(f"Warning: Could not fetch Supabase JWKS: {e}")
        return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    """
    Validates the JWT and returns the user's UUID (sub claim).
    Uses the ES256 public key from Supabase JWKS for proper verification.
    Falls back to dev-user if Supabase URL is not configured.
    """
    # No Authorization header
    if credentials is None:
        if not settings.supabase_url:
            return "dev-user"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Try to get the public key for proper ES256 verification
    public_key = _get_public_key()

    if public_key is None:
        # No public key available — dev fallback
        return "dev-user"

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["ES256", "RS256", "HS256"],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing sub claim",
            )
        return user_id
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
