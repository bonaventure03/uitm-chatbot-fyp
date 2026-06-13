"""Analytics API — usage stats and knowledge base health for the admin panel."""
from fastapi import APIRouter, Depends
from app.api.auth import verify_token
from app import db

router = APIRouter(prefix="/api/admin", tags=["analytics"])


@router.get("/analytics")
async def get_analytics(days: int = 30, _: str = Depends(verify_token)):
    return db.get_analytics(days=days)
