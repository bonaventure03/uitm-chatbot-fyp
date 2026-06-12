"""Vector store: Pinecone + OpenAI embeddings.
Matches report Figure 3.11 (LangChain embedding + indexing).
"""
from typing import List, Dict, Any
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from pinecone import Pinecone, ServerlessSpec

from app.config import config


class VectorStore:
    def __init__(self):
        self.pc = Pinecone(api_key=config.PINECONE_API_KEY)
        self._ensure_index()

        self.embeddings = OpenAIEmbeddings(
            model=config.EMBEDDING_MODEL,
            api_key=config.OPENAI_API_KEY,
        )

        self.store = PineconeVectorStore(
            index_name=config.PINECONE_INDEX_NAME,
            embedding=self.embeddings,
        )

    def _ensure_index(self):
        """Create Pinecone index if it doesn't exist."""
        existing = [idx.name for idx in self.pc.list_indexes()]
        if config.PINECONE_INDEX_NAME not in existing:
            self.pc.create_index(
                name=config.PINECONE_INDEX_NAME,
                dimension=config.EMBEDDING_DIMENSIONS,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )

    def add_documents(self, documents: List[Document]) -> List[str]:
        """Embed and upsert documents into Pinecone."""
        if not documents:
            return []
        return self.store.add_documents(documents)

    def similarity_search(self, query: str, k: int = None) -> List[Document]:
        """Retrieve top-k most relevant chunks."""
        k = k or config.TOP_K
        return self.store.similarity_search(query, k=k)

    def delete_by_source(self, source_url: str):
        """Delete all chunks that came from a specific source URL."""
        index = self.pc.Index(config.PINECONE_INDEX_NAME)
        index.delete(filter={"source": source_url})

    def delete_by_root_url(self, root_url: str):
        """Delete every chunk crawled from a given root URL.

        Website crawls store the portal's root URL on each chunk's
        ``metadata.root_url`` while ``metadata.source`` is the specific page,
        so deleting by ``source`` only removes the root page. This method
        wipes the whole crawl in one shot — needed for re-seeding portals.
        """
        index = self.pc.Index(config.PINECONE_INDEX_NAME)
        index.delete(filter={"root_url": root_url})

    def delete_by_portal_name(self, portal_name: str):
        """Delete all chunks with the given portal_name metadata value.

        Useful for cleaning up orphaned vectors whose source registry entry
        was already removed (e.g. old Playwright crawls deleted from the UI
        but whose per-page chunks remain in Pinecone).
        """
        index = self.pc.Index(config.PINECONE_INDEX_NAME)
        index.delete(filter={"portal_name": portal_name})

    def list_sources(self) -> List[Dict[str, Any]]:
        """List unique data sources currently indexed.
        Note: Pinecone does not have a native 'list metadata' call.
        We maintain a lightweight source registry via a special 'registry' namespace.
        For a simple MVP we query a broad search. In production, store source
        metadata in a separate lightweight DB (SQLite) alongside Pinecone.
        """
        # MVP: this is a placeholder. The admin.py endpoint maintains its own
        # JSON registry of added sources for listing purposes.
        return []


# Singleton
vector_store = VectorStore() if config.PINECONE_API_KEY and "your-pinecone" not in (config.PINECONE_API_KEY or "") else None
