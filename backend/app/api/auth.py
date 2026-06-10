"""Admin authentication — JWT-based login gate for the knowledge base panel."""
from datetime import datetime, timedelta

import bcrypt
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import config
from app.limiter import limiter

router = APIRouter(prefix="/api/admin", tags=["auth"])
_security = HTTPBearer()

_ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 8


class LoginRequest(BaseModel):
    username: str
    password: str


def _create_token(username: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, config.JWT_SECRET, algorithm=_ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> str:
    """FastAPI dependency — validates Bearer token on protected admin routes."""
    try:
        payload = jwt.decode(credentials.credentials, config.JWT_SECRET, algorithms=[_ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token")
        return sub
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _verify_supabase(username: str, password: str) -> bool:
    """Look up the admin row in Supabase and verify the bcrypt hash."""
    from app.storage import _get_client
    client = _get_client()
    if client is None:
        return False
    try:
        result = (
            client.table("admins")
            .select("password_hash")
            .eq("username", username)
            .single()
            .execute()
        )
        if not result.data:
            return False
        stored = result.data["password_hash"]
        if isinstance(stored, str):
            stored = stored.encode("utf-8")
        return bcrypt.checkpw(password.encode("utf-8"), stored)
    except Exception:
        return False


@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest):
    if config.supabase_enabled():
        # Multi-admin path: credentials stored in Supabase admins table
        if not _verify_supabase(req.username, req.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    else:
        # Single-admin fallback: .env ADMIN_USERNAME / ADMIN_PASSWORD
        if req.username != config.ADMIN_USERNAME or req.password != config.ADMIN_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": _create_token(req.username), "expires_in": _TOKEN_EXPIRE_HOURS * 3600}
