"""Seed script - ingests UiTM public portals from seed_portals.json.

Run this ONCE after setting up .env and creating the Pinecone index:
    python seed_uitm.py

The portal list lives in ``seed_portals.json`` so admins can edit URLs
through the Admin Panel (Knowledge Base → UiTM Portals). This script just
re-crawls everything in that file from the command line.

For password-protected portals (Permata, uFuture, authenticated iStudent),
manually export documents and upload them through the Admin Panel.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

# Add app/ to path so imports work when running this script directly
sys.path.insert(0, str(Path(__file__).parent))

from app.rag.chunker import chunk_documents
from app.rag.vector_store import vector_store
from app.rag.loaders.website_loader import load_website


PORTALS_PATH = Path(__file__).parent / "seed_portals.json"


def main():
    if vector_store is None:
        print("❌ Vector store not configured. Check your .env file.")
        return

    if not PORTALS_PATH.exists():
        print(f"❌ {PORTALS_PATH.name} not found.")
        return

    with open(PORTALS_PATH, "r", encoding="utf-8") as f:
        portals = json.load(f)

    total_chunks = 0
    for portal in portals:
        print(f"\n🔍 Crawling: {portal['name']} ...")
        try:
            # Wipe existing chunks first so re-runs don't pile up duplicates
            try:
                vector_store.delete_by_root_url(portal["url"])
            except Exception as e:
                print(f"   (skipping pre-wipe: {e})")

            docs = load_website(
                portal["url"],
                portal_name=portal["name"],
                max_pages=portal["max_pages"],
            )
            print(f"   Found {len(docs)} pages.")

            chunk_count = 0
            if docs:
                chunks = chunk_documents(docs)
                vector_store.add_documents(chunks)
                chunk_count = len(chunks)
                total_chunks += chunk_count
                print(f"   ✅ Indexed {chunk_count} chunks.")

            portal["last_seeded_at"] = datetime.utcnow().isoformat()
            portal["last_chunk_count"] = chunk_count
        except Exception as e:
            print(f"   ⚠️  Failed: {e}")

    with open(PORTALS_PATH, "w", encoding="utf-8") as f:
        json.dump(portals, f, indent=2)

    print(f"\n🎉 Seed complete. Total chunks indexed: {total_chunks}")


if __name__ == "__main__":
    main()
