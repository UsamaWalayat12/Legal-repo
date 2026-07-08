import os
import uuid
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from typing import Optional
from datetime import datetime, timezone

from app.auth import get_current_user
from app.config import settings
from app.db.session import (
    create_document,
    update_document_status,
    list_documents,
    get_document,
    delete_document_record,
    create_chunks,
    delete_chunks_by_document,
)
from app.ingestion.extract import extract_pages
from app.ingestion.clean import clean_pages
from app.ingestion.chunk import chunk_pages
from app.vectorstore.embeddings import embed_texts
from app.vectorstore.chroma_client import add_chunks, delete_document_chunks

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "uploads",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".txt"}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
    workspace_id: str = Form("default"),
    user_id: str = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    save_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    file_type = "pdf" if ext == ".pdf" else "txt"
    doc = create_document(file.filename, doc_type, workspace_id=workspace_id, user_id=user_id)

    try:
        pages = extract_pages(save_path, file_type)
        pages = clean_pages(pages)
        chunks = chunk_pages(pages, settings.chunk_size, settings.chunk_overlap)

        texts = [c["text"] for c in chunks]
        embeddings = embed_texts(texts)

        chunk_records = []
        chroma_chunks = []
        for i, chunk in enumerate(chunks):
            chunk_records.append({
                "document_id": doc["id"],
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"],
                "text": chunk["text"],
                "token_count": len(chunk["text"].split()),
            })
            chroma_chunks.append({
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"],
                "text": chunk["text"],
                "embedding": embeddings[i],
            })

        create_chunks(chunk_records)
        add_chunks(
            document_id=doc["id"],
            chunks_with_embeddings=chroma_chunks,
            doc_name=file.filename,
            doc_type=doc_type,
            upload_date=datetime.now(timezone.utc).isoformat(),
            workspace_id=workspace_id,
            user_id=user_id,
        )

        update_document_status(doc["id"], "ready", page_count=len(pages))
        return get_document(doc["id"])

    except Exception as e:
        logger.exception("Ingestion failed")
        update_document_status(doc["id"], "failed", error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.get("")
async def list_all_documents(
    workspace_id: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    return list_documents(user_id=user_id, workspace_id=workspace_id)


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    user_id: str = Depends(get_current_user),
):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Ownership check
    if doc.get("user_id") and doc["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this document")
    try:
        delete_chunks_by_document(doc_id)
        delete_document_chunks(doc_id)
        delete_document_record(doc_id)
    except Exception as e:
        logger.exception("Delete failed")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
    return {"message": "Document deleted"}
