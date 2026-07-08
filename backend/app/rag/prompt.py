from typing import List


GROUNDED_SYSTEM_PROMPT = """
You are a legal document analysis assistant. Your role is to answer questions based ONLY on the provided document excerpts.

Rules:
1. Answer ONLY using the numbered source excerpts provided below.
2. Every factual claim must reference a source number like [1], [2].
3. If the sources do not contain enough information to answer, respond exactly: "The provided documents do not contain enough information to answer this question." and nothing else.
4. Never use outside knowledge about law, tax, or any topic not present in the sources.
5. Be concise and direct.
"""


def build_grounded_prompt(question: str, retrieved_chunks: List[dict]) -> str:
    context_parts = []
    for i, chunk in enumerate(retrieved_chunks):
        context_parts.append(
            f"[{i + 1}] ({chunk['doc_name']}, p.{chunk['page_number']}): {chunk['text']}"
        )

    context = "\n\n".join(context_parts)

    prompt = f"""{GROUNDED_SYSTEM_PROMPT}

SOURCE EXCERPTS:
{context}

QUESTION: {question}

ANSWER:"""
    return prompt
