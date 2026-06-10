"""Seed-portal management API.

The UiTM portals (Table 3.2 of the CSP600 report) are stored in
``backend/seed_portals.json`` so admins can edit URLs, add/remove portals,
and re-crawl them from the UI without touching code or re-running the CLI
seed script.
"""
import json
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.api.auth import verify_token
from app.rag.chunker import chunk_documents
from app.rag.vector_store import vector_store
from app.rag.loaders.website_loader import load_website

router = APIRouter(prefix="/api/admin/seed", tags=["seed"])

PORTALS_PATH = Path(__file__).parent.parent.parent / "seed_portals.json"

# In-memory job store — keyed by job_id hex string
_jobs: dict[str, dict] = {}


def _load_portals() -> list[dict]:
    if not PORTALS_PATH.exists():
        return []
    with open(PORTALS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_portals(data: list[dict]):
    with open(PORTALS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _find_portal(portals: list[dict], portal_id: str) -> Optional[dict]:
    return next((p for p in portals if p["id"] == portal_id), None)


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
    return {"portals": _load_portals()}


@router.post("/portals")
async def add_portal(req: PortalCreate, _: str = Depends(verify_token)):
    portals = _load_portals()
    new_portal = {
        "id": uuid.uuid4().hex[:8],
        "name": req.name,
        "url": req.url,
        "max_pages": req.max_pages,
        "last_seeded_at": None,
        "last_chunk_count": 0,
    }
    portals.append(new_portal)
    _save_portals(portals)
    return {"status": "ok", "portal": new_portal}


@router.put("/portals/{portal_id}")
async def update_portal(portal_id: str, req: PortalUpdate, _: str = Depends(verify_token)):
    portals = _load_portals()
    portal = _find_portal(portals, portal_id)
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")

    if req.name is not None:
        portal["name"] = req.name
    if req.url is not None:
        portal["url"] = req.url
    if req.max_pages is not None:
        portal["max_pages"] = req.max_pages
    _save_portals(portals)
    return {"status": "ok", "portal": portal}


@router.delete("/portals/{portal_id}")
async def delete_portal(portal_id: str, _: str = Depends(verify_token)):
    portals = _load_portals()
    portal = _find_portal(portals, portal_id)
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")

    # Best-effort: also wipe the portal's chunks from Pinecone so deleting a
    # portal doesn't leave orphan vectors behind
    if vector_store:
        try:
            vector_store.delete_by_root_url(portal["url"])
        except Exception as e:
            print(f"Warning: could not delete vectors for {portal['url']}: {e}")

    portals = [p for p in portals if p["id"] != portal_id]
    _save_portals(portals)
    return {"status": "ok", "deleted": portal}


def _recrawl_one(portal: dict) -> dict:
    """Wipe + recrawl a single portal. Returns updated portal entry.
    Raises HTTPException on failure so the endpoint surfaces useful errors.
    """
    if vector_store is None:
        raise HTTPException(status_code=503, detail="Vector store not configured.")

    # Wipe existing chunks for this portal
    try:
        vector_store.delete_by_root_url(portal["url"])
    except Exception as e:
        print(f"Warning: pre-recrawl delete failed for {portal['url']}: {e}")

    # Crawl + index
    docs = load_website(
        portal["url"],
        portal_name=portal["name"],
        max_pages=portal["max_pages"],
    )
    chunk_count = 0
    if docs:
        chunks = chunk_documents(docs)
        vector_store.add_documents(chunks)
        chunk_count = len(chunks)

    portal["last_seeded_at"] = datetime.utcnow().isoformat()
    portal["last_chunk_count"] = chunk_count
    return portal


def _bg_recrawl_one(job_id: str, portals: list[dict], portal: dict) -> None:
    """Background thread: recrawl a single portal and write result to _jobs."""
    try:
        updated = _recrawl_one(portal)
        _save_portals(portals)
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["result"] = {"portal": updated}
    except Exception as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = detail


def _bg_run_seed(job_id: str, portals: list[dict]) -> None:
    """Background thread: recrawl every portal and write results to _jobs."""
    results = []
    total_chunks = 0
    for portal in portals:
        try:
            updated = _recrawl_one(portal)
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
    _save_portals(portals)
    _jobs[job_id]["status"] = "done"
    _jobs[job_id]["result"] = {"results": results, "total_chunks": total_chunks}


@router.post("/portals/{portal_id}/recrawl")
async def recrawl_portal(portal_id: str, _: str = Depends(verify_token)):
    portals = _load_portals()
    portal = _find_portal(portals, portal_id)
    if not portal:
        raise HTTPException(status_code=404, detail="Portal not found")

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"status": "running", "result": None, "error": None}
    threading.Thread(
        target=_bg_recrawl_one, args=(job_id, portals, portal), daemon=True
    ).start()
    return {"status": "running", "job_id": job_id, "portal_id": portal_id}


@router.post("/run")
async def run_seed(_: str = Depends(verify_token)):
    """Kick off a background re-crawl of every portal and return a job_id to poll."""
    portals = _load_portals()
    if not portals:
        return {"status": "done", "job_id": None, "results": [], "total_chunks": 0}

    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"status": "running", "result": None, "error": None}
    threading.Thread(
        target=_bg_run_seed, args=(job_id, portals), daemon=True
    ).start()
    return {"status": "running", "job_id": job_id}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, _: str = Depends(verify_token)):
    """Poll the status of a background crawl job."""
    job = _jobs.get(job_id)
    if not job:
        # Server was restarted — treat as completed so the UI stops polling
        return {"status": "not_found"}
    return {"status": job["status"], "result": job.get("result"), "error": job.get("error")}
