import os
import chromadb
from chromadb.config import Settings
from typing import List, Optional, Dict
from app.config import settings

os.makedirs(settings.chroma_persist_dir, exist_ok=True)

_client = chromadb.PersistentClient(
    path=settings.chroma_persist_dir,
    settings=Settings(anonymized_telemetry=False),
)

_collection = _client.get_or_create_collection(
    name="legal_docs",
    metadata={"hnsw:space": "cosine"},
)


def add_chunks(
    document_id: str,
    chunks_with_embeddings: List[Dict],
    doc_name: str,
    doc_type: str,
    upload_date: str,
    workspace_id: str = "default",
    user_id: str = "dev-user",
):
    ids = []
    embeddings = []
    metadatas = []
    documents = []

    for chunk in chunks_with_embeddings:
        ids.append(f"{document_id}_{chunk['chunk_index']}")
        embeddings.append(chunk["embedding"])
        metadatas.append({
            "document_id": document_id,
            "doc_name": doc_name,
            "doc_type": doc_type,
            "page_number": chunk["page_number"],
            "chunk_index": chunk["chunk_index"],
            "upload_date": upload_date,
            "workspace_id": workspace_id,
            "user_id": user_id,
        })
        documents.append(chunk["text"])

    _collection.add(
        ids=ids,
        embeddings=embeddings,
        metadatas=metadatas,
        documents=documents,
    )


def query(
    query_embedding: List[float],
    top_k: int = 6,
    filter: Optional[Dict] = None,
):
    kwargs = {
        "query_embeddings": [query_embedding],
        "n_results": top_k,
        "include": ["metadatas", "documents", "distances"],
    }
    if filter:
        kwargs["where"] = filter

    results = _collection.query(**kwargs)

    output = []
    if results["ids"] and results["ids"][0]:
        for i in range(len(results["ids"][0])):
            meta = results["metadatas"][0][i]
            output.append({
                "chunk_id": results["ids"][0][i],
                "document_id": meta["document_id"],
                "doc_name": meta["doc_name"],
                "doc_type": meta["doc_type"],
                "page_number": meta["page_number"],
                "chunk_index": meta["chunk_index"],
                "workspace_id": meta.get("workspace_id", "default"),
                "user_id": meta.get("user_id", ""),
                "text": results["documents"][0][i],
                "score": 1 - results["distances"][0][i],
            })
    return output


def delete_document_chunks(document_id: str):
    _collection.delete(where={"document_id": document_id})
