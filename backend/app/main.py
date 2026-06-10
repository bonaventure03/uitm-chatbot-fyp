"""FastAPI main entry point for the UiTM Campus Assistant."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import config
from app.limiter import limiter
from app.api import chat, admin, seed
from app.api import auth, feedback

app = FastAPI(
    title="UiTM Campus Assistant API",
    description="RAG-powered chatbot for UiTM Samarahan students",
    version="0.1.0",
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# HTTPS redirect in production
if config.APP_ENV == "production":
    from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

# CORS — origins come from .env so dev and prod differ without code changes
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(seed.router)
app.include_router(feedback.router)


@app.get("/")
async def root():
    return {
        "name": "UiTM Campus Assistant",
        "status": "online",
        "endpoints": {
            "chat": "POST /api/chat",
            "add_webpage": "POST /api/admin/sources/webpage",
            "add_website": "POST /api/admin/sources/website",
            "add_document": "POST /api/admin/sources/document",
            "add_text": "POST /api/admin/sources/text",
            "add_faq": "POST /api/admin/sources/faq",
            "list_sources": "GET /api/admin/sources",
            "delete_source": "DELETE /api/admin/sources/{id}",
            "list_seed_portals": "GET /api/admin/seed/portals",
            "add_seed_portal": "POST /api/admin/seed/portals",
            "update_seed_portal": "PUT /api/admin/seed/portals/{id}",
            "delete_seed_portal": "DELETE /api/admin/seed/portals/{id}",
            "recrawl_seed_portal": "POST /api/admin/seed/portals/{id}/recrawl",
            "run_seed": "POST /api/admin/seed/run",
        },
    }


@app.on_event("startup")
async def startup_check():
    try:
        config.validate()
        print("✅ Config validated. All API keys present.")
    except ValueError as e:
        print(f"⚠️  {e}")
        print("   The app will start but RAG endpoints will fail until keys are set.")
