import re
from typing import List, Dict


def clean_text(text: str) -> str:
    text = re.sub(r'[^\x20-\x7E\n]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


def clean_pages(pages: List[Dict]) -> List[Dict]:
    return [{"page_number": p["page_number"], "text": clean_text(p["text"])} for p in pages]
