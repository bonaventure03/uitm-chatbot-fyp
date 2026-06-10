"""Registry persistence — Supabase when configured, local JSON fallback otherwise.

Two registries live here:
  sources      — replaces sources_registry.json
  seed_portals — replaces seed_portals.json
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.config import config

_REGISTRY_PATH = Path(__file__).parent.parent / "sources_registry.json"
_PORTALS_PATH = Path(__file__).parent.parent / "seed_portals.json"


def _client():
    if not config.supabase_enabled():
        return None
    from app.storage import _get_client
    return _get_client()


# ── Sources ───────────────────────────────────────────────────────────────────

def _flatten(row: dict) -> dict:
    """Merge the extra jsonb column back into a flat dict."""
    flat = {k: v for k, v in row.items() if k != "extra"}
    flat.update(row.get("extra") or {})
    return flat


def load_sources() -> list[dict]:
    c = _client()
    if c is None:
        if not _REGISTRY_PATH.exists():
            return []
        with open(_REGISTRY_PATH) as f:
            return json.load(f)
    result = c.table("sources").select("*").order("added_at").execute()
    return [_flatten(r) for r in (result.data or [])]


def add_source(source_type: str, name: str, url: str, chunk_count: int, **extra) -> dict:
    c = _client()
    added_at = datetime.utcnow().isoformat()
    if c is None:
        entry = {
            "id": str(uuid.uuid4()),
            "source_type": source_type,
            "name": name,
            "url": url,
            "chunk_count": chunk_count,
            "added_at": added_at,
            **extra,
        }
        rows = load_sources()
        rows.append(entry)
        with open(_REGISTRY_PATH, "w") as f:
            json.dump(rows, f, indent=2)
        return entry
    row = {
        "source_type": source_type,
        "name": name,
        "url": url,
        "chunk_count": chunk_count,
        "added_at": added_at,
        "extra": extra or {},
    }
    result = c.table("sources").insert(row).execute()
    return _flatten(result.data[0])


def delete_source(source_id: str) -> Optional[dict]:
    c = _client()
    if c is None:
        rows = load_sources()
        entry = next((s for s in rows if s["id"] == source_id), None)
        if not entry:
            return None
        rows = [s for s in rows if s["id"] != source_id]
        with open(_REGISTRY_PATH, "w") as f:
            json.dump(rows, f, indent=2)
        return entry
    result = c.table("sources").delete().eq("id", source_id).execute()
    if not result.data:
        return None
    return _flatten(result.data[0])


# ── Seed Portals ──────────────────────────────────────────────────────────────

def load_portals() -> list[dict]:
    c = _client()
    if c is None:
        if not _PORTALS_PATH.exists():
            return []
        with open(_PORTALS_PATH) as f:
            return json.load(f)
    result = c.table("seed_portals").select("*").order("name").execute()
    return result.data or []


def add_portal(name: str, url: str, max_pages: int) -> dict:
    c = _client()
    portal = {
        "id": uuid.uuid4().hex[:8],
        "name": name,
        "url": url,
        "max_pages": max_pages,
        "last_seeded_at": None,
        "last_chunk_count": 0,
    }
    if c is None:
        rows = load_portals()
        rows.append(portal)
        with open(_PORTALS_PATH, "w") as f:
            json.dump(rows, f, indent=2)
        return portal
    result = c.table("seed_portals").insert(portal).execute()
    return result.data[0]


def update_portal(portal_id: str, fields: dict) -> Optional[dict]:
    c = _client()
    if c is None:
        rows = load_portals()
        portal = next((p for p in rows if p["id"] == portal_id), None)
        if not portal:
            return None
        portal.update(fields)
        with open(_PORTALS_PATH, "w") as f:
            json.dump(rows, f, indent=2)
        return portal
    result = c.table("seed_portals").update(fields).eq("id", portal_id).execute()
    if not result.data:
        return None
    return result.data[0]


def delete_portal(portal_id: str) -> Optional[dict]:
    c = _client()
    if c is None:
        rows = load_portals()
        portal = next((p for p in rows if p["id"] == portal_id), None)
        if not portal:
            return None
        rows = [p for p in rows if p["id"] != portal_id]
        with open(_PORTALS_PATH, "w") as f:
            json.dump(rows, f, indent=2)
        return portal
    result = c.table("seed_portals").delete().eq("id", portal_id).execute()
    if not result.data:
        return None
    return result.data[0]
