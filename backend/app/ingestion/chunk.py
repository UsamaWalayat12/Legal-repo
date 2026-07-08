from typing import List, Dict
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_pages(pages: List[Dict], chunk_size: int = 800, chunk_overlap: int = 150) -> List[Dict]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " "],
        length_function=len,
    )

    chunks = []
    chunk_index = 0
    for page in pages:
        page_texts = splitter.split_text(page["text"])
        for text in page_texts:
            chunks.append({
                "text": text,
                "page_number": page["page_number"],
                "chunk_index": chunk_index,
            })
            chunk_index += 1

    return chunks
