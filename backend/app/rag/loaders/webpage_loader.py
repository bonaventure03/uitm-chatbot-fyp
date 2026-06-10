"""Single webpage loader - fetches one URL and extracts clean text."""
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from langchain_core.documents import Document


def clean_html(html: str) -> str:
    """Strip script/style tags and extract visible text."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    # Collapse whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def load_webpage(url: str, portal_name: str = None) -> list[Document]:
    """Fetch a single webpage and return as a Document.

    Args:
        url: Full URL to fetch
        portal_name: Friendly name e.g. 'iStudent Portal', 'Bendahari'
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (UiTM Campus Assistant Bot) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    text = clean_html(response.text)
    if not text:
        return []

    # Try to grab page title
    soup = BeautifulSoup(response.text, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else url

    metadata = {
        "source": url,
        "source_type": "webpage",
        "portal_name": portal_name or title,
        "title": title,
        "scraped_at": datetime.utcnow().isoformat(),
    }
    return [Document(page_content=text, metadata=metadata)]
