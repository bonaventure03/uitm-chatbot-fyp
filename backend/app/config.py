"""Configuration module - loads and validates environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # API Keys
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

    # Pinecone
    PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "uitm-chatbot-index")

    # LLM
    LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-4-5")
    LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))

    # Embeddings
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))

    # Chunking
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))

    # Retrieval
    TOP_K = int(os.getenv("TOP_K", "4"))

    # Admin auth
    ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")

    # Deployment
    APP_ENV = os.getenv("APP_ENV", "development")
    ALLOWED_ORIGINS: list[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")

    # Supabase Storage (for knowledge-base file uploads)
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "knowledge-base")

    @classmethod
    def supabase_enabled(cls) -> bool:
        return bool(cls.SUPABASE_URL and cls.SUPABASE_KEY)

    @classmethod
    def validate(cls):
        """Ensure all required keys are present."""
        missing = []
        if not cls.ANTHROPIC_API_KEY or "your-key" in (cls.ANTHROPIC_API_KEY or ""):
            missing.append("ANTHROPIC_API_KEY")
        if not cls.OPENAI_API_KEY or "your-openai" in (cls.OPENAI_API_KEY or ""):
            missing.append("OPENAI_API_KEY")
        if not cls.PINECONE_API_KEY or "your-pinecone" in (cls.PINECONE_API_KEY or ""):
            missing.append("PINECONE_API_KEY")
        if missing:
            raise ValueError(
                f"Missing or placeholder API keys in .env: {', '.join(missing)}"
            )


config = Config()
