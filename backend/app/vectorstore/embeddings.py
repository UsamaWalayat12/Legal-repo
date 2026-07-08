from typing import List
from google import genai

from app.config import settings

if not settings.google_api_key:
    raise ValueError(
        "GOOGLE_API_KEY is not set. Create a backend/.env file with:\n"
        "GOOGLE_API_KEY=your_gemini_api_key_here\n\n"
        "Get a free API key from: https://aistudio.google.com/apikey"
    )

_client = genai.Client(api_key=settings.google_api_key)


def embed_texts(texts: List[str]) -> List[List[float]]:
    result = _client.models.embed_content(
        model=settings.embedding_model,
        contents=texts,
        config={"task_type": "RETRIEVAL_DOCUMENT"},
    )
    return [e.values for e in result.embeddings]


def embed_query(text: str) -> List[float]:
    result = _client.models.embed_content(
        model=settings.embedding_model,
        contents=text,
        config={"task_type": "RETRIEVAL_QUERY"},
    )
    return result.embeddings[0].values
