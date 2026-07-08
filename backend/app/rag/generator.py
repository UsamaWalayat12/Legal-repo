import re
import logging
from typing import List
from google import genai

from app.config import settings
from app.rag.prompt import build_grounded_prompt

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=settings.google_api_key)

CONFIDENCE_THRESHOLD = 0.15


def generate_answer(question: str, retrieved_chunks: List[dict]) -> dict:
    if not retrieved_chunks:
        return {
            "answer": "The provided documents do not contain enough information to answer this question.",
            "citations": [],
            "insufficient_evidence": True,
        }

    if retrieved_chunks[0]["score"] < CONFIDENCE_THRESHOLD:
        return {
            "answer": "The provided documents do not contain enough information to answer this question.",
            "citations": [],
            "insufficient_evidence": True,
        }

    prompt = build_grounded_prompt(question, retrieved_chunks)

    try:
        response = _client.models.generate_content(
            model=settings.chat_model,
            contents=prompt,
        )
        answer = response.text.strip()
    except Exception as e:
        logger.exception("Gemini API call failed")
        raise

    refusal = "do not contain enough information"
    if refusal in answer.lower():
        return {
            "answer": answer,
            "citations": [],
            "insufficient_evidence": True,
        }

    markers = re.findall(r'\[(\d+)\]', answer)
    seen = set()
    citations = []
    for m in markers:
        idx = int(m) - 1
        if idx not in seen and 0 <= idx < len(retrieved_chunks):
            seen.add(idx)
            chunk = retrieved_chunks[idx]
            citations.append({
                "marker": f"[{m}]",
                "doc_name": chunk["doc_name"],
                "page_number": chunk["page_number"],
                "chunk_id": chunk["chunk_id"],
            })

    return {
        "answer": answer,
        "citations": citations,
        "insufficient_evidence": False,
    }
