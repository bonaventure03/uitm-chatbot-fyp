"""Admin API - knowledge base data source management."""
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel

from app.api.auth import verify_token
from app.rag.chunker import chunk_documents
from app.rag.vector_store import vector_store
from app.rag.loaders.webpage_loader import load_webpage
from app.rag.loaders.website_loader import load_website
from app.rag.loaders.document_loader import load_document
from app.rag.loaders.text_loader import load_text
from app.rag.loaders.faq_loader import load_faqs
from app import storage
from app import db

router = APIRouter(prefix="/api/admin", tags=["admin"])

_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".gif", ".webp"}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _ingest(documents: list) -> int:
    """Chunk + embed + store. Returns number of chunks created."""
    if not documents:
        return 0
    if vector_store is None:
        raise HTTPException(status_code=503, detail="Vector store not configured.")
    chunks = chunk_documents(documents)
    vector_store.add_documents(chunks)
    return len(chunks)


# ============ REQUEST MODELS ============

class WebpageRequest(BaseModel):
    url: str
    portal_name: Optional[str] = None


class WebsiteRequest(BaseModel):
    url: str
    portal_name: Optional[str] = None
    max_pages: int = 20


class TextRequest(BaseModel):
    title: str
    content: str
    portal_name: Optional[str] = None


class FAQItem(BaseModel):
    question: str
    answer: str


class FAQRequest(BaseModel):
    portal_name: str = "UiTM FAQ"
    source_url: Optional[str] = None
    faqs: list[FAQItem]


# ============ ENDPOINTS ============

@router.post("/sources/webpage")
async def add_webpage(req: WebpageRequest, _: str = Depends(verify_token)):
    docs = load_webpage(req.url, portal_name=req.portal_name)
    chunk_count = _ingest(docs)
    entry = db.add_source("webpage", req.portal_name or req.url, req.url, chunk_count)
    return {"status": "ok", "source": entry}


@router.post("/sources/website")
async def add_website(req: WebsiteRequest, _: str = Depends(verify_token)):
    docs = load_website(req.url, portal_name=req.portal_name, max_pages=req.max_pages)
    chunk_count = _ingest(docs)
    entry = db.add_source(
        "website", req.portal_name or req.url, req.url, chunk_count,
        pages_crawled=len(docs),
    )
    return {"status": "ok", "source": entry}


@router.post("/sources/document")
async def add_document(
    file: UploadFile = File(...),
    portal_name: Optional[str] = Form(None),
    source_url: Optional[str] = Form(None),
    _: str = Depends(verify_token),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Use: {', '.join(_ALLOWED_EXTENSIONS)}",
        )

    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    try:
        upload_info = storage.upload_file(file.filename, data)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {e}")

    stored_url = source_url or upload_info["public_url"]

    try:
        docs = load_document(
            file_bytes=data,
            filename=file.filename,
            portal_name=portal_name,
            source_url=stored_url,
        )
        chunk_count = _ingest(docs)
    except Exception as e:
        storage.delete_file(upload_info["storage_path"], backend=upload_info["backend"])
        raise HTTPException(status_code=500, detail=f"Document processing failed: {e}")

    entry = db.add_source(
        "document",
        portal_name or file.filename,
        stored_url,
        chunk_count,
        filename=file.filename,
        storage_path=upload_info["storage_path"],
        storage_backend=upload_info["backend"],
    )
    return {"status": "ok", "source": entry}


@router.post("/sources/text")
async def add_text(req: TextRequest, _: str = Depends(verify_token)):
    docs = load_text(req.content, title=req.title, portal_name=req.portal_name)
    chunk_count = _ingest(docs)
    entry = db.add_source(
        "text", req.portal_name or req.title, f"text://{req.title}", chunk_count,
    )
    return {"status": "ok", "source": entry}


@router.post("/sources/faq")
async def add_faq(req: FAQRequest, _: str = Depends(verify_token)):
    faqs = [{"question": item.question, "answer": item.answer} for item in req.faqs]
    docs = load_faqs(faqs, portal_name=req.portal_name, source_url=req.source_url)
    chunk_count = _ingest(docs)
    entry = db.add_source(
        "faq",
        req.portal_name,
        req.source_url or f"faq://{req.portal_name}",
        chunk_count,
        faq_count=len(faqs),
    )
    return {"status": "ok", "source": entry}


@router.get("/sources")
async def list_sources(_: str = Depends(verify_token)):
    return {"sources": db.load_sources()}


@router.delete("/sources/purge-portal")
async def purge_portal(portal_name: str, _: str = Depends(verify_token)):
    """Delete all Pinecone vectors for a given portal_name.

    Use this to clean up orphaned chunks whose registry entry was already
    removed (e.g. a Playwright crawl that was deleted from the UI but left
    stale vectors behind). The portal_name must match the metadata value
    stored when the source was originally ingested.
    """
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not configured.")
    try:
        vector_store.delete_by_portal_name(portal_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ok", "purged_portal": portal_name}


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str, _: str = Depends(verify_token)):
    entry = db.delete_source(source_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Source not found")

    if vector_store:
        try:
            if entry.get("source_type") == "website":
                # Website crawls tag every page chunk with root_url, not source
                vector_store.delete_by_root_url(entry["url"])
            else:
                vector_store.delete_by_source(entry["url"])
        except Exception as e:
            print(f"Warning: could not delete from vector store: {e}")

    if entry.get("storage_path"):
        try:
            storage.delete_file(entry["storage_path"], backend=entry.get("storage_backend"))
        except Exception as e:
            print(f"Warning: could not delete from storage: {e}")

    return {"status": "ok", "deleted": entry}
