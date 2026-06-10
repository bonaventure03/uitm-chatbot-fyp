"""Supabase Storage wrapper for knowledge-base file uploads.

Falls back to local disk (backend/uploads/) when Supabase env vars are not set,
so the app keeps working during development without a Supabase project.
"""
import uuid
import mimetypes
from pathlib import Path
from typing import Optional

from app.config import config

# Local fallback directory (used only when Supabase isn't configured)
_LOCAL_UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
_LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)

_client = None


def _get_client():
    """Lazy-init the Supabase client so importing this module doesn't crash
    when credentials aren't set yet."""
    global _client
    if _client is not None:
        return _client
    if not config.supabase_enabled():
        return None
    from supabase import create_client
    _client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
    return _client


def _make_storage_path(filename: str) -> str:
    """Prefix every upload with a UUID so duplicate filenames don't collide."""
    safe_name = Path(filename).name
    return f"{uuid.uuid4().hex}_{safe_name}"


def upload_file(filename: str, data: bytes) -> dict:
    """Upload bytes to Supabase Storage (or local disk fallback).

    Returns dict with:
        storage_path: key used to delete the object later
        public_url:   URL the file can be retrieved from
        backend:      "supabase" or "local"
    """
    storage_path = _make_storage_path(filename)
    client = _get_client()

    if client is None:
        # Local fallback
        local_path = _LOCAL_UPLOAD_DIR / storage_path
        local_path.write_bytes(data)
        return {
            "storage_path": storage_path,
            "public_url": f"local://{storage_path}",
            "backend": "local",
        }

    bucket = config.SUPABASE_BUCKET
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    client.storage.from_(bucket).upload(
        path=storage_path,
        file=data,
        file_options={"content-type": content_type, "upsert": "false"},
    )
    public_url = client.storage.from_(bucket).get_public_url(storage_path)
    return {
        "storage_path": storage_path,
        "public_url": public_url,
        "backend": "supabase",
    }


def delete_file(storage_path: str, backend: Optional[str] = None) -> bool:
    """Delete a file from whichever backend stored it. Returns True on success."""
    if not storage_path:
        return False

    # Infer backend from current config if not specified
    if backend is None:
        backend = "supabase" if config.supabase_enabled() else "local"

    if backend == "local":
        local_path = _LOCAL_UPLOAD_DIR / storage_path
        if local_path.exists():
            local_path.unlink()
        return True

    client = _get_client()
    if client is None:
        return False
    client.storage.from_(config.SUPABASE_BUCKET).remove([storage_path])
    return True
