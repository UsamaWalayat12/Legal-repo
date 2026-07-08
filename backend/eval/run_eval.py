"""
Evaluation script for LexIntel RAG.

Runs predefined questions against the /ask endpoint and prints pass/fail.
Works with or without auth:
  - Set EVAL_TOKEN env var to a valid Supabase JWT to test authenticated endpoints.
  - Leave it unset to rely on the dev-user fallback (no JWT secret configured).

Usage:
  python eval/run_eval.py
  EVAL_TOKEN=eyJ... python eval/run_eval.py
"""
import sys
import os
import json
import urllib.request
import urllib.error

BASE_URL = os.getenv("EVAL_BASE_URL", "http://localhost:8000")
TOKEN = os.getenv("EVAL_TOKEN", "")

QUESTIONS = [
    {
        "question": "What is the monthly rent in the lease agreement?",
        "expect_refusal": False,
    },
    {
        "question": "How long is the NDA term?",
        "expect_refusal": False,
    },
    {
        "question": "Are pets allowed in the rental property?",
        "expect_refusal": False,
    },
    {
        "question": "What is the late fee for rent?",
        "expect_refusal": False,
    },
    {
        "question": "What is the GDP growth rate of France in 2025?",
        "expect_refusal": True,
    },
    {
        "question": "Who won the Super Bowl last year?",
        "expect_refusal": True,
    },
]


def ask(question: str, doc_type: str = None) -> dict:
    data = json.dumps({"question": question, "doc_type": doc_type}).encode()
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    req = urllib.request.Request(
        f"{BASE_URL}/ask",
        data=data,
        headers=headers,
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def check_hybrid_scores(result: dict) -> bool:
    """Verify that retrieved chunks contain hybrid score breakdown."""
    chunks = result.get("retrieved_chunks", [])
    if not chunks:
        return True  # nothing to check
    first = chunks[0]
    return "vector_score" in first and "bm25_score" in first


def main():
    passed = 0
    failed = 0

    print("=" * 60)
    print("LexIntel v0.2 — Eval Run")
    print(f"Base URL : {BASE_URL}")
    print(f"Auth     : {'token provided' if TOKEN else 'dev-user fallback'}")
    print("=" * 60)

    for i, q in enumerate(QUESTIONS, 1):
        print(f"\n[{i}] Q: {q['question']}")
        try:
            result = ask(q["question"])
            answer_preview = result["answer"][:120].replace("\n", " ")
            print(f"    A: {answer_preview}...")
            print(f"    Insufficient evidence : {result['insufficient_evidence']}")

            if result["citations"]:
                for c in result["citations"]:
                    print(f"      {c['marker']} {c['doc_name']} p.{c['page_number']}")

            # Check hybrid scores present
            has_hybrid = check_hybrid_scores(result)
            if not has_hybrid:
                print("    ⚠ Hybrid scores missing from retrieved_chunks")

            if result["insufficient_evidence"] == q["expect_refusal"]:
                status = "Refusal correct" if q["expect_refusal"] else "Answer provided"
                print(f"    ✓ {status}")
                passed += 1
            else:
                print(
                    f"    ✗ Expected refusal={q['expect_refusal']}, "
                    f"got {result['insufficient_evidence']}"
                )
                failed += 1

        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"    ✗ HTTP {e.code}: {body[:200]}")
            failed += 1
        except Exception as e:
            print(f"    ✗ Error: {e}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed out of {len(QUESTIONS)}")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
