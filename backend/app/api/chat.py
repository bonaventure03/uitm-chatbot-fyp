"""Chat API - the main student-facing endpoint."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.limiter import limiter
from app.rag.generator import generator

router = APIRouter(prefix="/api", tags=["chat"])

_MAX_MESSAGE_LENGTH = 1000


class ChatRequest(BaseModel):
    message: str


class Source(BaseModel):
    portal_name: str
    url: str
    title: str = ""


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    retrieved_count: int


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(request: Request, req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(req.message) > _MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail=f"Message exceeds {_MAX_MESSAGE_LENGTH} characters.")
    if generator is None:
        raise HTTPException(status_code=503, detail="RAG generator not initialized - check .env")

    try:
        result = generator.answer(req.message)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")
