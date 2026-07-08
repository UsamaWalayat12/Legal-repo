import fitz
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


def extract_pages(file_path: str, file_type: str) -> List[Dict]:
    if file_type == "pdf":
        return _extract_pdf(file_path)
    elif file_type == "txt":
        return _extract_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_pdf(file_path: str) -> List[Dict]:
    pages = []
    doc = fitz.open(file_path)
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        if not text.strip():
            logger.warning(f"Page {page_num + 1} has no extractable text (may be scanned/image-only)")
        pages.append({"page_number": page_num + 1, "text": text})
    doc.close()
    return pages


def _extract_txt(file_path: str) -> List[Dict]:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read()
    return [{"page_number": 1, "text": text}]
