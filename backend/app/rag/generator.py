"""RAG answer generator using Claude."""
import re
import requests
from bs4 import BeautifulSoup
from langchain_anthropic import ChatAnthropic
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.config import config
from app.rag.vector_store import vector_store


SYSTEM_PROMPT = """You are the UiTM Campus Assistant - a friendly, knowledgeable chatbot helping UiTM Samarahan students navigate campus digital services.

Your job is to answer student questions using ONLY the context provided below, which was retrieved from official UiTM sources (iStudent, Permata, uFuture, Bendahari, HEP, Academic Calendar, Convocation portal, PTAR library, FAQ SSO, etc.).

RESPONSE FORMATTING RULES (always follow these):
1. Open with a brief, friendly one-line acknowledgment of what the student is asking. VARY your phrasing every time - do not start the same way twice.
2. Choose the right format based on the question type:
   - PROCEDURAL questions (how to, steps to, log in, register, check, pay, apply, submit, navigate): use a NUMBERED step-by-step guide.
   - DEFINITION / INFORMATION questions (what is, what are, explain, tell me about, who is): answer in clear, friendly prose — NO numbered steps.
3. Include any specific DATES, DEADLINES, or IMPORTANT NOTES from the retrieved context.
4. Keep the tone warm, supportive, and student-friendly.

CRITICAL RULES:
- Only use information that appears in the retrieved context. Do not invent portal names, URLs, or procedures.
- If the context does NOT contain the answer, honestly say so and suggest the most likely UiTM portal the student should check manually.
- Vary sentence structure, vocabulary, and opening phrases every response - never sound template-generated.
- Do not mention that you are using "context" or "retrieved documents" - respond naturally as an assistant.
- Keep answers GENERAL and applicable to all UiTM students. If the context contains specific student names, matriculation numbers, course codes (e.g. CSC662), class group codes (e.g. CDCS2304A), or lecturer names, IGNORE those details entirely — they are scraping artifacts and must not appear in your answer.
- Do NOT add a "Source:" line or any citation at the end of your response. The system automatically surfaces relevant portal links for the student.
- ALWAYS include the full URL inline whenever you mention a portal, system, or website the student should visit — e.g. "visit the PERMATA Library at https://library.uitm.edu.my/" or "log in at https://ufuture.uitm.edu.my". Only use URLs that appear in the retrieved context. This is required so the correct Visit Portal links are shown to the student.

RETRIEVED CONTEXT:
{context}
"""


USER_PROMPT = "{question}"


class RAGGenerator:
    def __init__(self):
        self.llm = ChatAnthropic(
            model=config.LLM_MODEL,
            temperature=config.LLM_TEMPERATURE,
            api_key=config.ANTHROPIC_API_KEY,
            max_tokens=1024,
        )
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("user", USER_PROMPT),
        ])

    def _fetch_page_title(self, url: str) -> str:
        """Return the browser <title> of a URL.

        Tries the exact URL first, then the root domain as a fallback so that
        deep paths on government portals (which often require sessions or block
        direct access) still yield a meaningful name.
        """
        from urllib.parse import urlparse
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        try:
            parsed = urlparse(url)
            root_url = f"{parsed.scheme}://{parsed.netloc}/"
        except Exception:
            return ""

        candidates = [url] if url == root_url else [url, root_url]

        for try_url in candidates:
            try:
                resp = requests.get(try_url, headers=headers, timeout=5, allow_redirects=True)
                if resp.status_code == 200 and "text/html" in resp.headers.get("Content-Type", ""):
                    resp.encoding = resp.apparent_encoding or "utf-8"
                    soup = BeautifulSoup(resp.text, "html.parser")
                    if soup.title and soup.title.string:
                        title = soup.title.string.strip()
                        if title:
                            return title
            except Exception:
                continue
        return ""

    def _extract_urls(self, text: str) -> list[str]:
        """Extract unique URLs from answer text, handling markdown link syntax.

        Claude sometimes writes [text](URL) or [URL](URL). The plain \\S+ regex
        would consume the ](URL part as part of the first match, producing a
        garbled string. This method handles both markdown and bare URLs correctly.
        """
        seen: set[str] = set()
        urls: list[str] = []

        # Pass 1 — markdown links [any text](URL): capture only the href
        for m in re.finditer(r'\[[^\]]*\]\((https?://[^)\s]+)\)', text):
            url = m.group(1).rstrip('.,;:\'\"*')
            if url not in seen:
                seen.add(url)
                urls.append(url)

        # Pass 2 — bare URLs not already captured (negative lookbehind skips markdown hrefs)
        for m in re.finditer(r'(?<!\()(https?://[^\s\[\]()<>"\' ]+)', text):
            url = m.group(1).rstrip('.,;:\'\")*')
            if url not in seen:
                seen.add(url)
                urls.append(url)

        return urls

    def _format_context(self, docs: list[Document]) -> str:
        """Format retrieved chunks with source attribution."""
        if not docs:
            return "(No relevant documents were found.)"
        parts = []
        for i, doc in enumerate(docs, 1):
            portal = doc.metadata.get("portal_name", "UiTM")
            source = doc.metadata.get("source", "unknown")
            parts.append(
                f"--- Source {i}: {portal} ({source}) ---\n{doc.page_content}"
            )
        return "\n\n".join(parts)

    def answer(self, question: str) -> dict:
        """Main RAG entrypoint.

        Returns:
            {
                "answer": str,                  # the generated response
                "sources": [                    # unique portals referenced
                    {"portal_name": ..., "url": ..., "title": ...}
                ],
                "retrieved_count": int
            }
        """
        if vector_store is None:
            return {
                "answer": "The chatbot is not fully configured yet. Please ensure Pinecone API key is set in .env.",
                "sources": [],
                "retrieved_count": 0,
            }

        # Step 1: Retrieve
        docs = vector_store.similarity_search(question, k=config.TOP_K)

        # Step 2: Format context
        context = self._format_context(docs)

        # Step 3: Generate
        chain = self.prompt | self.llm | StrOutputParser()
        answer_text = chain.invoke({"context": context, "question": question})

        # Step 4: Extract URLs the answer body tells students to actually visit.
        # These are the actionable links inside the steps — not metadata source URLs.
        seen_urls: set[str] = set()
        sources = []
        for url in self._extract_urls(answer_text):
            if url in seen_urls:
                continue
            seen_urls.add(url)
            page_title = self._fetch_page_title(url)
            sources.append({
                "portal_name": page_title or url,
                "url": url,
                "title": "",
            })

        # Fallback: if the answer contained no URLs, use the top retrieved chunk URL
        if not sources:
            for doc in docs:
                url = doc.metadata.get("source")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    page_title = self._fetch_page_title(url)
                    sources.append({
                        "portal_name": page_title or doc.metadata.get("portal_name", url),
                        "url": url,
                        "title": "",
                    })
                    break

        return {
            "answer": answer_text,
            "sources": sources,
            "retrieved_count": len(docs),
        }


# Singleton
generator = RAGGenerator() if config.ANTHROPIC_API_KEY and "your-key" not in (config.ANTHROPIC_API_KEY or "") else None
