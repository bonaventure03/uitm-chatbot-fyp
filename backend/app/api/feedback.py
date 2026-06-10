"""User feedback API — thumbs up/down on assistant answers.

Negative ('down') ratings are surfaced in the admin panel so admins can review
which questions the assistant answered poorly and improve the knowledge base.

Feedback rows live in the Supabase ``feedback`` table. When Supabase isn't
configured (local dev), submissions are silently no-ops so the chat keeps working.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.api.auth import verify_token
from app.storage import _get_client

router = APIRouter(tags=["feedback"])


class FeedbackRequest(BaseModel):
    question: str
    answer: str
    rating: str  # 'up' or 'down'
    sources: Optional[list] = None


# ============ PUBLIC: submit feedback ============

@router.post("/api/feedback")
async def submit_feedback(req: FeedbackRequest):
    if req.rating not in ("up", "down"):
        raise HTTPException(status_code=400, detail="rating must be 'up' or 'down'")

    client = _get_client()
    if client is None:
        # Supabase not configured — accept but don't persist (dev fallback)
        return {"status": "ok", "stored": False}

    try:
        client.table("feedback").insert({
            "question": req.question,
            "answer": req.answer,
            "rating": req.rating,
            "sources": req.sources,
        }).execute()
        return {"status": "ok", "stored": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not store feedback: {e}")


# ============ ADMIN: review negative feedback ============

@router.get("/api/admin/feedback")
async def list_feedback(_: str = Depends(verify_token)):
    """Return 'down'-rated feedback grouped by similar (normalized) question."""
    client = _get_client()
    if client is None:
        return {"groups": [], "total": 0}

    try:
        result = (
            client.table("feedback")
            .select("id, question, answer, sources, created_at")
            .eq("rating", "down")
            .order("created_at", desc=True)
            .execute()
        )
        rows = result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load feedback: {e}")

    # Group by normalized question text so repeated questions cluster together
    groups: dict[str, list] = {}
    for row in rows:
        key = (row.get("question") or "").strip().lower()
        groups.setdefault(key, []).append(row)

    grouped = []
    for items in groups.values():
        # items already sorted newest-first from the query
        grouped.append({
            "question": items[0]["question"],
            "count": len(items),
            "latest": items[0]["created_at"],
            "items": [
                {
                    "id": it["id"],
                    "answer": it["answer"],
                    "sources": it.get("sources"),
                    "created_at": it["created_at"],
                }
                for it in items
            ],
        })

    # Most-complained questions first, then most recent
    grouped.sort(key=lambda g: (g["count"], g["latest"]), reverse=True)

    return {"groups": grouped, "total": len(rows)}


@router.delete("/api/admin/feedback/{feedback_id}")
async def delete_feedback(feedback_id: str, _: str = Depends(verify_token)):
    client = _get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        client.table("feedback").delete().eq("id", feedback_id).execute()
        return {"status": "ok", "deleted": feedback_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not delete feedback: {e}")
