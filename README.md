# LexIntel v0.2 — Legal & Tax Document Intelligence

A RAG (Retrieval-Augmented Generation) product: upload legal/tax documents into workspaces, ask questions, and get grounded, cited answers powered by Google Gemini.

**What's new in v0.2:**
- ✅ Auth / user sessions — Supabase Auth (JWT), sign up / sign in / sign out
- ✅ Matter / workspace — create named workspaces, scope uploads and queries per workspace
- ✅ shadcn/ui — full component library (Button, Card, Badge, Select, Toast, etc.)
- ✅ Hybrid search — BM25 + vector score fusion (0.6 × vector + 0.4 × BM25) with debug breakdown

---

## Architecture

```
┌─────────────────────────────────────────────┐
│   Next.js 15 Frontend                        │
│  - Auth screen (sign in / sign up)           │
│  - Workspace switcher                        │
│  - Upload · Document list · Ask box          │
│  - Citation cards · Hybrid debug panel       │
└─────────────────┬───────────────────────────┘
                  │ REST + JWT Bearer
                  ▼
┌─────────────────────────────────────────────┐
│   FastAPI Backend                            │
│  /workspaces  CRUD                           │
│  /documents   upload / list / delete         │
│  /search      hybrid retrieval               │
│  /ask         RAG answer                     │
└──────┬───────────────────┬───────────────────┘
       │                   │
┌──────▼──────┐   ┌────────▼────────┐
│  Supabase   │   │  ChromaDB       │
│  Postgres   │   │  vectors +      │
│  workspaces │   │  metadata       │
│  documents  │   │  (per user +    │
│  chunks     │   │   workspace)    │
└─────────────┘   └─────────────────┘
       │                   │
┌──────▼───────────────────▼──────┐
│   Google Gemini API              │
│  text-embedding-004              │
│  gemini-2.0-flash                │
└──────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui | SaaS-quality UI with accessible components |
| Backend | Python + FastAPI | Python-native RAG ecosystem |
| Auth | Supabase Auth (JWT HS256) | Free managed auth, matches Supabase DB |
| Vector store | ChromaDB (local persistent) | Zero infra, metadata + vectors together |
| Hybrid search | BM25 (rank-bm25) + vector fusion | Best of keyword + semantic retrieval |
| Embeddings | Gemini `text-embedding-004` | Fast, high quality, free tier |
| LLM | Gemini `gemini-2.0-flash` | Strong grounded instruction following |
| Database | Supabase (Postgres) | Managed Postgres, auth integration |
| PDF parsing | PyMuPDF | Per-page text + page numbers |
| Chunking | LangChain `RecursiveCharacterTextSplitter` | Boundary-respecting chunking |

---

## Setup

### Prerequisites
- Python 3.9+, Node.js 18+
- Supabase project — [supabase.com](https://supabase.com)
- Google Gemini API key — [aistudio.google.com](https://aistudio.google.com/apikey)

### 1. Supabase SQL Setup

Run this in your Supabase SQL editor:

```sql
-- Workspaces (new in v0.2)
create table workspaces (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  name text not null,
  created_at timestamptz default now()
);
create index on workspaces(user_id);

-- Documents (user_id added in v0.2)
create table documents (
  id uuid default gen_random_uuid() primary key,
  file_name text not null,
  doc_type text not null default 'other',
  upload_date timestamptz default now(),
  page_count int default 0,
  status text default 'processing',
  workspace_id text default 'default',
  user_id uuid,
  error_message text
);
create index on documents(user_id);
create index on documents(workspace_id);

-- Chunks (unchanged)
create table chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents(id) on delete cascade,
  chunk_index int not null,
  page_number int not null,
  text text not null,
  token_count int
);
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
# Edit .env — fill in GOOGLE_API_KEY, SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
# (JWT secret: Supabase Dashboard → Project Settings → API → JWT Secret)
.venv\Scripts\python -m uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
copy .env.local.example .env.local
# Edit .env.local — fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# (Anon key: Supabase Dashboard → Project Settings → API → anon/public)
npm run dev
```

Open http://localhost:3000, sign up for an account, then upload docs and ask questions.

### 4. Docker (one command)

```bash
# Add all env vars to backend/.env first, then:
docker-compose up --build
```

---

## How It Works

### Auth
Sign up / sign in via Supabase Auth REST API. JWT is stored in localStorage and sent as `Authorization: Bearer <token>` on every API call. Backend verifies the JWT signature using `SUPABASE_JWT_SECRET` and extracts the `user_id` (sub claim) to scope all data.

### Workspaces (Matters)
Users can create named workspaces (e.g. "Smith vs Jones", "Tax 2024"). Documents are uploaded into a workspace. All queries can be scoped to a workspace so answers only draw from relevant documents.

### Hybrid Search
```
Query
  ├── Embed with Gemini → vector similarity in ChromaDB (top 24 candidates)
  └── BM25 keyword score on same candidates
        ↓
  Fused score = 0.6 × vector + 0.4 × BM25
        ↓
  Re-rank, return top 6
```
The debug panel in the UI shows all three scores (hybrid, vector, BM25) per chunk as progress bars.

### Grounded Answering
System prompt strictly prohibits outside knowledge. LLM cites `[N]` for every claim or refuses with an exact message. Score threshold (0.15) short-circuits before calling Gemini if evidence is too weak.

---

## API Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | Liveness probe |
| GET | `/workspaces` | ✅ | List user's workspaces |
| POST | `/workspaces` | ✅ | Create workspace |
| DELETE | `/workspaces/{id}` | ✅ | Delete workspace |
| POST | `/documents/upload` | ✅ | Upload document (multipart) |
| GET | `/documents` | ✅ | List documents (optional `?workspace_id=`) |
| DELETE | `/documents/{id}` | ✅ | Delete document |
| POST | `/search` | ✅ | Hybrid search (no LLM) |
| POST | `/ask` | ✅ | RAG Q&A with citations |

---

## Evaluation

```bash
cd backend
# Without auth (dev-user fallback):
python eval/run_eval.py

# With a real token:
set EVAL_TOKEN=eyJhbGci...
python eval/run_eval.py
```

6 test cases: 4 should answer with citations, 2 should refuse. Also validates hybrid score breakdown is present in the response.

---

## Demo Flow

1. Sign up at http://localhost:3000
2. Create a workspace (e.g. "Sample Docs")
3. Upload `backend/sample_docs/sample_lease.txt` and `sample_nda.txt`
4. Ask: *"What is the monthly rent?"* → cited answer with source card
5. Ask: *"What is the GDP of France?"* → refusal with amber banner
6. Open the hybrid debug panel to see vector + BM25 score breakdown

---

## What I'd Improve Next

- OCR fallback via pytesseract for scanned PDFs
- Supabase pgvector to unify DB + vector store
- Streaming answers from Gemini (`stream=True`)
- Cross-encoder re-ranking after BM25+vector fusion
- Background job queue (Celery/ARQ) for large batch ingestion
- Row-level security (RLS) in Supabase for hard multi-tenant isolation
