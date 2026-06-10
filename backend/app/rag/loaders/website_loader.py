"""Website loader - crawls a root domain up to a max depth/page limit."""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime
from langchain_core.documents import Document
from .webpage_loader import clean_html


def load_website(
    root_url: str,
    portal_name: str = None,
    max_pages: int = 20,
    same_domain_only: bool = True,
) -> list[Document]:
    """Crawl a website starting from root_url.

    Args:
        root_url: Starting URL
        portal_name: Friendly name
        max_pages: Hard cap on pages crawled (prevents runaway crawls)
        same_domain_only: Only follow links on the same domain
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (UiTM Campus Assistant Bot) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    }

    root_domain = urlparse(root_url).netloc
    visited = set()
    queue = [root_url]
    documents = []

    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code != 200:
                continue
            if "text/html" not in response.headers.get("Content-Type", ""):
                continue
        except Exception:
            continue

        text = clean_html(response.text)
        if text:
            soup = BeautifulSoup(response.text, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else url
            documents.append(Document(
                page_content=text,
                metadata={
                    "source": url,
                    "source_type": "website",
                    "portal_name": portal_name or root_domain,
                    "title": title,
                    "root_url": root_url,
                    "scraped_at": datetime.utcnow().isoformat(),
                },
            ))

        # Discover new links
        soup = BeautifulSoup(response.text, "html.parser")
        for link in soup.find_all("a", href=True):
            href = urljoin(url, link["href"])
            href = href.split("#")[0]  # strip fragment
            if not href.startswith("http"):
                continue
            if same_domain_only and urlparse(href).netloc != root_domain:
                continue
            if href not in visited and href not in queue:
                queue.append(href)

    return documents
