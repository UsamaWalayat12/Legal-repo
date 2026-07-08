"""
Hybrid retriever: combines vector similarity (ChromaDB) with BM25 keyword
matching.  Final score = 0.6 * vector_score + 0.4 * bm25_score (normalised).

Why hybrid?
- Vector search is great for semantic similarity ("monthly payment" ≈ "rent")
- BM25 is great for exact keyword matches ("Section 4.2", "Article III")
- Together they cover both ends of the spectrum.
"""
from typing import Optional, List
from rank_bm25 import BM25Okapi

from app.vectorstore.embeddings import embed_query
from app.vectorstore.chroma_client import query as chroma_query

# Weights for score fusion (must sum to 1.0)
VECTOR_WEIGHT = 0.6
BM25_WEIGHT = 0.4


def retrieve(
    query: str,
    top_k: int = 6,
    doc_type_filter: Optional[str] = None,
    workspace_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[dict]:
    """
    Returns up to `top_k` chunks ranked by a hybrid score.
    Falls back to pure vector search if BM25 corpus is empty.
    """
    query_embedding = embed_query(query)

    # Build ChromaDB where filter
    filter_dict = _build_filter(doc_type_filter, workspace_id, user_id)

    # Fetch a wider candidate pool for BM25 re-ranking (top_k * 4, min 20)
    candidate_k = max(top_k * 4, 20)
    candidates = chroma_query(query_embedding, top_k=candidate_k, filter=filter_dict)

    if not candidates:
        return []

    # --- BM25 ---
    tokenised_corpus = [c["text"].lower().split() for c in candidates]
    bm25 = BM25Okapi(tokenised_corpus)
    query_tokens = query.lower().split()
    raw_bm25_scores = bm25.get_scores(query_tokens)

    # Normalise BM25 scores to [0, 1]
    bm25_max = max(raw_bm25_scores) if max(raw_bm25_scores) > 0 else 1.0
    norm_bm25 = [s / bm25_max for s in raw_bm25_scores]

    # --- Fuse scores ---
    for i, chunk in enumerate(candidates):
        vector_score = chunk["score"]          # already [0,1] from cosine
        bm25_score = norm_bm25[i]
        chunk["vector_score"] = round(vector_score, 4)
        chunk["bm25_score"] = round(bm25_score, 4)
        chunk["score"] = round(
            VECTOR_WEIGHT * vector_score + BM25_WEIGHT * bm25_score, 4
        )

    # Sort by fused score descending and return top_k
    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:top_k]


def _build_filter(
    doc_type: Optional[str],
    workspace_id: Optional[str],
    user_id: Optional[str],
) -> Optional[dict]:
    """
    Builds a ChromaDB metadata filter.  ChromaDB requires a single `$and`
    wrapper when there are multiple conditions.
    """
    conditions = []
    if doc_type:
        conditions.append({"doc_type": {"$eq": doc_type}})
    if workspace_id:
        conditions.append({"workspace_id": {"$eq": workspace_id}})
    if user_id:
        conditions.append({"user_id": {"$eq": user_id}})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}
