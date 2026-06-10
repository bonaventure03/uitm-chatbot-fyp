"""FAQ loader - accepts Q&A pairs and formats them for retrieval."""
from datetime import datetime
from langchain_core.documents import Document


def load_faqs(faqs: list[dict], portal_name: str = "UiTM FAQ", source_url: str = None) -> list[Document]:
    """Accept a list of Q&A pairs.

    Args:
        faqs: [{"question": "...", "answer": "..."}, ...]
        portal_name: e.g. 'FAQ SSO'
        source_url: Optional origin URL (e.g. https://faqsso.uitm.edu.my/)

    Each FAQ becomes its own Document for precise retrieval - embedding
    each pair separately gives much better semantic matching than a single
    blob containing all FAQs.
    """
    documents = []
    for i, item in enumerate(faqs):
        q = item.get("question", "").strip()
        a = item.get("answer", "").strip()
        if not q or not a:
            continue

        # Combine Q&A with explicit labeling - helps retrieval
        content = f"Question: {q}\n\nAnswer: {a}"

        documents.append(Document(
            page_content=content,
            metadata={
                "source": source_url or f"faq://{portal_name}/{i}",
                "source_type": "faq",
                "portal_name": portal_name,
                "title": q[:100],  # first part of question as title
                "question": q,
                "scraped_at": datetime.utcnow().isoformat(),
            },
        ))
    return documents
