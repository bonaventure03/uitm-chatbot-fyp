"""Chunking module - splits documents into manageable pieces before embedding.
Matches report Figure 3.11: chunk_size=500, overlap=50.
"""
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from app.config import config


def chunk_documents(documents: list[Document]) -> list[Document]:
    """Split documents into overlapping chunks for better retrieval.

    RecursiveCharacterTextSplitter tries to split on paragraphs first,
    then sentences, then words - preserving semantic coherence.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_documents(documents)
