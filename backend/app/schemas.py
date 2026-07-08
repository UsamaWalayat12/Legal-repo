from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------

class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceResponse(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

class DocumentResponse(BaseModel):
    id: str
    file_name: str
    doc_type: str
    upload_date: datetime
    page_count: int
    status: str
    workspace_id: Optional[str] = None
    user_id: Optional[str] = None


class ChunkResponse(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    page_number: int
    text: str
    token_count: Optional[int] = None


# ---------------------------------------------------------------------------
# Search / Ask
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 6
    doc_type: Optional[str] = None
    workspace_id: Optional[str] = None


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    doc_name: str
    page_number: int
    chunk_index: int
    text: str
    score: float
    bm25_score: Optional[float] = None
    vector_score: Optional[float] = None


class SearchResponse(BaseModel):
    results: List[SearchResult]


class AskRequest(BaseModel):
    question: str
    doc_type: Optional[str] = None
    workspace_id: Optional[str] = None


class Citation(BaseModel):
    marker: str
    doc_name: str
    page_number: int
    chunk_id: str


class AskResponse(BaseModel):
    answer: str
    citations: List[Citation]
    insufficient_evidence: bool
    retrieved_chunks: List[SearchResult]
