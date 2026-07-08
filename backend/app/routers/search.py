from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.schemas import SearchRequest, SearchResponse, SearchResult
from app.rag.retriever import retrieve

router = APIRouter()


@router.post("", response_model=SearchResponse)
async def search_documents(
    req: SearchRequest,
    user_id: str = Depends(get_current_user),
):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    results = retrieve(
        req.query,
        top_k=req.top_k or 6,
        doc_type_filter=req.doc_type,
        workspace_id=req.workspace_id,
        user_id=user_id,
    )

    return SearchResponse(results=[SearchResult(**r) for r in results])
