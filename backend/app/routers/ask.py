from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.schemas import AskRequest, AskResponse, SearchResult
from app.rag.retriever import retrieve
from app.rag.generator import generate_answer

router = APIRouter()


@router.post("", response_model=AskResponse)
async def ask_question(
    req: AskRequest,
    user_id: str = Depends(get_current_user),
):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    retrieved = retrieve(
        req.question,
        doc_type_filter=req.doc_type,
        workspace_id=req.workspace_id,
        user_id=user_id,
    )

    if not retrieved:
        return AskResponse(
            answer="The provided documents do not contain enough information to answer this question.",
            citations=[],
            insufficient_evidence=True,
            retrieved_chunks=[],
        )

    result = generate_answer(req.question, retrieved)

    return AskResponse(
        answer=result["answer"],
        citations=result["citations"],
        insufficient_evidence=result["insufficient_evidence"],
        retrieved_chunks=[SearchResult(**r) for r in retrieved],
    )
