"""RAG answer generator using Claude.

Produces VARIED phrasing each call (temperature=0.7) while maintaining
consistent STRUCTURE: intro → numbered steps → dates → source link.
This satisfies the requirement that 'answers should not be fixed and use
different structures each time' while still being grounded in retrieved context.
"""
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
2. Provide a NUMBERED step-by-step navigation guide when the question requires the student to perform actions (logging in, registering, checking results, paying fees, etc.).
3. Include any specific DATES, DEADLINES, or IMPORTANT NOTES from the retrieved context.
4. End with the portal name and link where the student should go, formatted exactly as: "Source: [Portal Name] - [URL]"
5. Keep the tone warm, supportive, and student-friendly.

CRITICAL RULES:
- Only use information that appears in the retrieved context. Do not invent portal names, URLs, or procedures.
- If the context does NOT contain the answer, honestly say so and suggest the most likely UiTM portal the student should check manually.
- Vary sentence structure, vocabulary, and opening phrases every response - never sound template-generated.
- Do not mention that you are using "context" or "retrieved documents" - respond naturally as an assistant.

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

        # Step 4: Deduplicate sources for the response card
        seen_urls = set()
        sources = []
        for doc in docs:
            url = doc.metadata.get("source")
            if url and url not in seen_urls:
                seen_urls.add(url)
                sources.append({
                    "portal_name": doc.metadata.get("portal_name", "UiTM"),
                    "url": url,
                    "title": doc.metadata.get("title", ""),
                })

        return {
            "answer": answer_text,
            "sources": sources,
            "retrieved_count": len(docs),
        }


# Singleton
generator = RAGGenerator() if config.ANTHROPIC_API_KEY and "your-key" not in (config.ANTHROPIC_API_KEY or "") else None
