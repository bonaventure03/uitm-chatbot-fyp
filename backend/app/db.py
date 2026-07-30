"""Registry persistence — Supabase when configured, local JSON fallback otherwise.

Three registries live here:
  sources      — knowledge base source entries
  seed_portals — UiTM portal crawl config
  chat_logs    — per-message log for analytics
"""
import json
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import Optional

from app.config import config

_REGISTRY_PATH  = Path(__file__).parent.parent / "sources_registry.json"
_PORTALS_PATH   = Path(__file__).parent.parent / "seed_portals.json"
_CHAT_LOGS_PATH = Path(__file__).parent.parent / "chat_logs.json"

# ── Topic keyword classifier ───────────────────────────────────────────────────

_TOPICS = [
    ("Fees & Payment",      ["fee", "pay", "payment", "bill", "receipt", "fpx", "bendahari", "bursary"]),
    ("Course Registration", ["register", "registration", "course", "subject", "ecr", "enroll", "drop"]),
    ("Exams & Results",     ["exam", "result", "grade", "cgpa", "gpa", "pointer", "muet", "test", "final"]),
    ("Library / PTAR",      ["library", "ptar", "book", "journal", "ebook", "thesis", "permata", "borrow"]),
    ("Hostel & HEP",        ["hostel", "hep", "accommodation", "room", "dress", "attire", "college"]),
    ("Password & IT",       ["password", "reset", "login", "account", "email", "sso", "forgot"]),
    ("Convocation",         ["convo", "convocation", "graduation", "scroll", "ceremony"]),
]

def _parse_ts(value: str) -> Optional[datetime]:
    """Parse an ISO timestamp to naive UTC.

    Supabase returns tz-aware strings ("...+00:00") while the local JSON
    fallback writes naive ones — normalise both so they can be compared
    against ``datetime.utcnow()``.
    """
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError, TypeError):
        return None
    if dt.tzinfo is None:
        return dt
    return (dt - dt.utcoffset()).replace(tzinfo=None)


def _classify_topic(question: str) -> str:
    q = question.lower()
    for topic, keywords in _TOPICS:
        if any(kw in q for kw in keywords):
            return topic
    return "Other"


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


# ── Chat Logs ─────────────────────────────────────────────────────────────────

def _load_chat_logs() -> list[dict]:
    if not _CHAT_LOGS_PATH.exists():
        return []
    with open(_CHAT_LOGS_PATH) as f:
        return json.load(f)


def log_chat(question: str, had_answer: bool) -> None:
    """Store one chat log entry. Non-critical — never raises."""
    c = _client()
    entry = {
        "id": str(uuid.uuid4()),
        "question": question.strip()[:500],
        "had_answer": had_answer,
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        if c is None:
            logs = _load_chat_logs()
            logs.append(entry)
            if len(logs) > 10_000:
                logs = logs[-10_000:]
            with open(_CHAT_LOGS_PATH, "w") as f:
                json.dump(logs, f)
        else:
            c.table("chat_logs").insert(entry).execute()
    except Exception as e:
        # Never break the chat over a logging failure, but don't hide it either —
        # a missing chat_logs table silently empties the whole analytics panel.
        print(f"[log_chat] failed: {type(e).__name__}: {e}")


# ── Analytics ─────────────────────────────────────────────────────────────────

def get_analytics(days: int = 30) -> dict:
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    c = _client()

    # Chat logs
    log_error = None
    if c is None:
        logs = [l for l in _load_chat_logs() if l.get("created_at", "") >= cutoff]
        fb_up = fb_down = 0
        fb_by_q: dict = {}
    else:
        try:
            logs = (c.table("chat_logs").select("*").gte("created_at", cutoff).execute().data or [])
        except Exception as e:
            # Surfaced to the admin panel — otherwise a missing table just looks
            # like "nobody has asked anything yet".
            logs = []
            log_error = f"{type(e).__name__}: {e}"
            print(f"[analytics] could not read chat_logs: {log_error}")
        try:
            fb_rows = (c.table("feedback").select("question,rating").gte("created_at", cutoff).execute().data or [])
            fb_up   = sum(1 for r in fb_rows if r["rating"] == "up")
            fb_down = sum(1 for r in fb_rows if r["rating"] == "down")
            fb_by_q: dict = {}
            for r in fb_rows:
                k = (r.get("question") or "").strip().lower()
                fb_by_q.setdefault(k, {"up": 0, "down": 0})[r["rating"]] += 1
        except Exception:
            fb_up = fb_down = 0
            fb_by_q = {}

    total      = len(logs)
    fallbacks  = sum(1 for l in logs if not l.get("had_answer", True))
    total_fb   = fb_up + fb_down

    # Daily counts (last 14 days for chart)
    daily: dict[str, int] = defaultdict(int)
    for l in logs:
        daily[l.get("created_at", "")[:10]] += 1
    today = datetime.utcnow().date()
    daily_counts = [
        {"date": (today - timedelta(days=i)).isoformat(),
         "count": daily.get((today - timedelta(days=i)).isoformat(), 0)}
        for i in range(13, -1, -1)
    ]

    # Top questions
    q_counts = Counter((l.get("question") or "").strip().lower() for l in logs if l.get("question"))
    top_questions = []
    for q_lower, cnt in q_counts.most_common(8):
        original = next((l["question"] for l in logs if (l.get("question") or "").strip().lower() == q_lower), q_lower)
        fb = fb_by_q.get(q_lower, {"up": 0, "down": 0})
        t = fb["up"] + fb["down"]
        top_questions.append({
            "question": original[:80],
            "count": cnt,
            "satisfaction": round(fb["up"] / t, 2) if t else None,
        })

    # Topics
    topic_counts: dict[str, int] = defaultdict(int)
    for l in logs:
        topic_counts[_classify_topic(l.get("question", ""))] += 1
    topics = sorted(
        [{"name": n, "count": c, "pct": round(c / total * 100, 1) if total else 0}
         for n, c in topic_counts.items() if c > 0],
        key=lambda x: x["count"], reverse=True,
    )

    # KB health from seed portals
    kb_health = []
    for p in load_portals():
        last = p.get("last_seeded_at")
        parsed = _parse_ts(last) if last else None
        days_ago = (datetime.utcnow() - parsed).days if parsed else None
        kb_health.append({"name": p["name"], "chunks": p.get("last_chunk_count", 0),
                          "last_seeded_at": last, "days_ago": days_ago})

    return {
        "period_days":      days,
        "total_questions":  total,
        "feedback_count":   total_fb,
        "satisfaction_rate": round(fb_up / total_fb, 4) if total_fb else 0,
        "fallback_rate":    round(fallbacks / total, 4) if total else 0,
        "sources_count":    len(load_sources()),
        "log_error":        log_error,
        "daily_counts":     daily_counts,
        "top_questions":    top_questions,
        "topics":           topics,
        "kb_health":        kb_health,
    }
