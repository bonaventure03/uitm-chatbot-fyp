"""Seed-portal management API."""
import threading
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.api.auth import verify_token
from app.rag.chunker import chunk_documents
from app.rag.vector_store import vector_store
from app.rag.loaders.website_loader import load_website
from app import db

router = APIRouter(prefix="/api/admin/seed", tags=["seed"])

_jobs: dict[str, dict] = {}


# ============ MODELS ============

class PortalCreate(BaseModel):
    name: str
    url: str
    max_pages: int = 15


class PortalUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    max_pages: Optional[int] = None


# ============ ENDPOINTS ============

@router.get("/portals")
async def list_portals(_: str = Depends(verify_token)):
    return {"portals": db.load_portals()}


@router.post("/portals")
async def add_portal(req: PortalCreate, _: str = Depends(verify_token)):
    portal = db.add_portal(req.name, req.url, req.max_pages)
    return {"status": "ok", "portal": portal}


@router.put("/portals/{portal_id}")
async def update_portal(portal_id: str, req: PortalUpdate, _: str = Depends(verify_token)):
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    portal = db.update_portal(portal_id, fields)
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")
    return {"status": "ok", "portal": portal}


@router.delete("/portals/{portal_id}")
async def delete_portal(portal_id: str, _: str = Depends(verify_token)):
    portals = db.load_portals()
    portal = next((p for p in portals if p["id"] == portal_id), None)
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")

    if vector_store:
        try:
            vector_store.delete_by_root_url(portal["url"])
        except Exception as e:
            print(f"Warning: could not delete vectors for {portal['url']}: {e}")

    db.delete_portal(portal_id)
    return {"status": "ok", "deleted": portal}


# ============ BACKGROUND CRAWL ============

def _recrawl_one(portal: dict) -> dict:
    if vector_store is None:
        raise HTTPException(status_code=503, detail="Vector store not configured.")

    try:
        vector_store.delete_by_root_url(portal["url"])
    except Exception as e:
        print(f"Warning: pre-recrawl delete failed for {portal['url']}: {e}")

    docs = load_website(portal["url"], portal_name=portal["name"], max_pages=portal["max_pages"])
    chunk_count = 0
    if docs:
        chunks = chunk_documents(docs)
        vector_store.add_documents(chunks)
        chunk_count = len(chunks)

    portal["last_seeded_at"] = datetime.utcnow().isoformat()
    portal["last_chunk_count"] = chunk_count
    return portal


def _bg_recrawl_one(job_id: str, portal: dict) -> None:
    try:
        updated = _recrawl_one(portal)
        db.update_portal(updated["id"], {
            "last_seeded_at": updated["last_seeded_at"],
            "last_chunk_count": updated["last_chunk_count"],
        })
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["result"] = {"portal": updated}
    except Exception as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = detail


def _bg_run_seed(job_id: str, portals: list[dict]) -> None:
    results = []
    total_chunks = 0
    for portal in portals:
        try:
            updated = _recrawl_one(portal)
            db.update_portal(updated["id"], {
                "last_seeded_at": updated["last_seeded_at"],
                "last_chunk_count": updated["last_chunk_count"],
            })
            results.append({
                "id": updated["id"],
                "name": updated["name"],
                "url": updated["url"],
                "chunks": updated["last_chunk_count"],
                "success": True,
            })
            total_chunks += updated["last_chunk_count"]
        except Exception as exc:
            detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
            results.append({
                "id": portal["id"],
                "name": portal["name"],
                "url": portal["url"],
                "success": False,
                "error": detail,
            })
    _jobs[job_id]["status"] = "done"
    _jobs[job_id]["result"] = {"results": results, "total_chunks": total_chunks}


@router.post("/portals/{portal_id}/recrawl")
async def recrawl_portal(portal_id: str, _: str = Depends(verify_token)):
    portals = db.load_portals()
    portal = next((p for p in portals if p["id"] == portal_id), None)
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"status": "running", "result": None, "error": None}
    threading.Thread(target=_bg_recrawl_one, args=(job_id, portal), daemon=True).start()
    return {"status": "running", "job_id": job_id, "portal_id": portal_id}


@router.post("/run")
async def run_seed(_: str = Depends(verify_token)):
    portals = db.load_portals()
    if not portals:
        return {"status": "done", "job_id": None, "results": [], "total_chunks": 0}

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"status": "running", "result": None, "error": None}
    threading.Thread(target=_bg_run_seed, args=(job_id, portals), daemon=True).start()
    return {"status": "running", "job_id": job_id}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, _: str = Depends(verify_token)):
    job = _jobs.get(job_id)
    if not job:
        return {"status": "not_found"}
    return {"status": job["status"], "result": job.get("result"), "error": job.get("error")}
