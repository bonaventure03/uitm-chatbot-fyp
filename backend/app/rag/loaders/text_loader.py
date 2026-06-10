"""Raw text loader - for admins pasting custom content directly."""
from datetime import datetime
from langchain_core.documents import Document


def load_text(content: str, title: str, portal_name: str = None, source_url: str = None) -> list[Document]:
    """Accept raw text content entered by an admin.

    Useful for quick additions like 'Dress code summary' or announcements
    that don't have a dedicated webpage.
    """
    if not content or not content.strip():
        return []

    metadata = {
        "source": source_url or f"text://{title}",
        "source_type": "text",
        "portal_name": portal_name or "Admin Text",
        "title": title,
        "scraped_at": datetime.utcnow().isoformat(),
    }
    return [Document(page_content=content, metadata=metadata)]
