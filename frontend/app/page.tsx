"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Search,
  LogOut,
  Scale,
  BookOpen,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AuthScreen } from "@/components/auth-screen";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useAuth } from "@/lib/auth-context";
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
  ask,
  getAuthToken,
  type Document,
  type AskResponse,
  type SearchResult,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";

// ─── Upload Area ─────────────────────────────────────────────────────────────

function UploadArea({
  onUploaded,
  workspaceId,
}: {
  onUploaded: () => void;
  workspaceId: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("other");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        await uploadDocument(file, docType, workspaceId ?? "default");
        toast({ title: `"${file.name}" uploaded successfully` });
        onUploaded();
      } catch (e: unknown) {
        toast({
          title: "Upload failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [docType, workspaceId, onUploaded]
  );

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
        dragOver ? "border-zinc-500 bg-zinc-50" : "border-zinc-300 bg-white"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) handleUpload(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          ) : (
            <Upload className="h-5 w-5 text-zinc-500" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-700">
            {uploading ? "Uploading..." : "Upload a document"}
          </p>
          <p className="text-xs text-zinc-400">PDF or TXT · drag &amp; drop or click</p>
        </div>
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          Choose file
        </Button>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <option value="other">General</option>
          <option value="lease">Lease</option>
          <option value="nda">NDA</option>
          <option value="tax">Tax</option>
          <option value="tos">Terms of Service</option>
        </select>
      </div>
    </div>
  );
}

// ─── Document List ────────────────────────────────────────────────────────────

function DocumentList({
  refresh,
  docs,
  setDocs,
  workspaceId,
}: {
  refresh: number;
  docs: Document[];
  setDocs: (d: Document[]) => void;
  workspaceId: string | null;
}) {
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!getAuthToken()) return; // don't call API without a token
    setLoading(true);
    try {
      const d = await listDocuments(workspaceId ?? undefined);
      setDocs(d);
    } catch (e: unknown) {
      toast({
        title: "Failed to load documents",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [setDocs, workspaceId]);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteDocument(id);
      setDocs(docs.filter((d) => d.id !== id));
      toast({ title: `"${name}" deleted` });
    } catch (e: unknown) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  if (loading && docs.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100" />
        ))}
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <BookOpen className="h-8 w-8 text-zinc-300" />
        <p className="text-sm text-zinc-400">No documents yet</p>
        <p className="text-xs text-zinc-300">Upload a PDF or TXT file to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-start justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2.5"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{doc.file_name}</p>
              <p className="text-xs text-zinc-400">
                {doc.page_count} pages · {new Date(doc.upload_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            <Badge
              variant={
                doc.status === "ready"
                  ? "success"
                  : doc.status === "failed"
                  ? "destructive"
                  : "warning"
              }
            >
              {doc.status}
            </Badge>
            <Badge variant="secondary">{doc.doc_type}</Badge>
            <button
              onClick={() => handleDelete(doc.id, doc.file_name)}
              className="rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500"
              title="Delete document"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Ask Box ─────────────────────────────────────────────────────────────────

function AskBox({
  onAnswer,
  workspaceId,
}: {
  onAnswer: (r: AskResponse) => void;
  workspaceId: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [docType, setDocType] = useState("");

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const result = await ask(question, docType || undefined, workspaceId ?? undefined);
      onAnswer(result);
    } catch (e: unknown) {
      toast({
        title: "Request failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const SAMPLE_QUESTIONS = [
    "What is the monthly rent?",
    "What is the NDA term?",
    "Are pets allowed?",
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          Ask a question
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleAsk()}
            placeholder="Ask a question about your documents..."
            className="flex-1"
          />
          <Button onClick={handleAsk} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          >
            <option value="">All doc types</option>
            <option value="lease">Lease</option>
            <option value="nda">NDA</option>
            <option value="tax">Tax</option>
          </select>
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"
            >
              {q}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Citation Card ────────────────────────────────────────────────────────────

function CitationCard({ marker, doc_name, page_number }: { marker: string; doc_name: string; page_number: number }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
        {marker.replace(/[\[\]]/g, "")}
      </span>
      <div>
        <p className="text-xs font-medium text-zinc-800">{doc_name}</p>
        <p className="text-xs text-zinc-500">Page {page_number}</p>
      </div>
    </div>
  );
}

// ─── Chunk Score Bar ──────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-right text-[10px] text-zinc-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(value * 100, 100).toFixed(0)}%` }}
        />
      </div>
      <span className="w-8 text-[10px] text-zinc-500">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ─── Retrieved Chunk Debug Card ───────────────────────────────────────────────

function ChunkDebugCard({ chunk, index }: { chunk: SearchResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">#{index + 1}</span>
            <span className="truncate text-xs font-medium text-zinc-700">{chunk.doc_name}</span>
            <span className="text-xs text-zinc-400">p.{chunk.page_number}</span>
          </div>
          {/* Hybrid score bars */}
          <div className="mt-2 space-y-1">
            <ScoreBar label="Hybrid" value={chunk.score} color="bg-zinc-800" />
            {chunk.vector_score !== undefined && (
              <ScoreBar label="Vector" value={chunk.vector_score} color="bg-blue-400" />
            )}
            {chunk.bm25_score !== undefined && (
              <ScoreBar label="BM25" value={chunk.bm25_score} color="bg-emerald-400" />
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      {expanded && (
        <p className="mt-2 border-t border-zinc-100 pt-2 text-[11px] leading-5 text-zinc-600">
          {chunk.text}
        </p>
      )}
    </div>
  );
}

// ─── Answer Panel ─────────────────────────────────────────────────────────────

function AnswerPanel({ result }: { result: AskResponse | null }) {
  const [showDebug, setShowDebug] = useState(false);

  if (!result) return null;

  return (
    <Card
      className={
        result.insufficient_evidence
          ? "border-amber-200 bg-amber-50"
          : "border-zinc-200"
      }
    >
      <CardContent className="pt-5 space-y-4">
        {/* Status banner */}
        <div className="flex items-center gap-2">
          {result.insufficient_evidence ? (
            <>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-700">
                Insufficient evidence in uploaded documents
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-700">
                Answer grounded in your documents
              </span>
            </>
          )}
        </div>

        {/* Answer text */}
        <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-800">
          {result.answer}
        </p>

        {/* Citation cards */}
        {result.citations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Sources
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {result.citations.map((c) => (
                <CitationCard
                  key={c.marker}
                  marker={c.marker}
                  doc_name={c.doc_name}
                  page_number={c.page_number}
                />
              ))}
            </div>
          </div>
        )}

        {/* Hybrid debug panel */}
        {result.retrieved_chunks.length > 0 && (
          <div className="border-t border-zinc-100 pt-3">
            <button
              onClick={() => setShowDebug((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600"
            >
              <Zap className="h-3.5 w-3.5" />
              Hybrid retrieval debug ({result.retrieved_chunks.length} chunks)
              {showDebug ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {showDebug && (
              <div className="mt-3 space-y-2">
                {result.retrieved_chunks.map((chunk, i) => (
                  <ChunkDebugCard key={chunk.chunk_id} chunk={chunk} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, logout, isLoading } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [docs, setDocs] = useState<Document[]>([]);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("All Documents");

  const handleUploaded = useCallback(() => setRefresh((n) => n + 1), []);

  const handleSelectWorkspace = useCallback((id: string | null, name: string) => {
    setWorkspaceId(id);
    setWorkspaceName(name);
    setRefresh((n) => n + 1);
    setAnswer(null);
  }, []);

  // While checking localStorage for a saved session
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
      </div>
    );
  }

  // Not logged in → show auth screen (no API calls will fire)
  if (!user) return <AuthScreen />;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
              <Scale className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-zinc-900">LexIntel</p>
              <p className="text-[10px] text-zinc-400">Legal &amp; Tax Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-400 sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-6 py-6">
        {/* Left sidebar */}
        <aside className="flex w-72 shrink-0 flex-col gap-4">
          {/* Workspace switcher */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Workspace
            </p>
            <WorkspaceSwitcher
              currentWorkspaceId={workspaceId}
              onSelect={handleSelectWorkspace}
            />
          </div>

          <Separator />

          {/* Upload */}
          <UploadArea onUploaded={handleUploaded} workspaceId={workspaceId} />

          {/* Document list */}
          <div className="flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {workspaceName}
            </p>
            <DocumentList
              refresh={refresh}
              docs={docs}
              setDocs={setDocs}
              workspaceId={workspaceId}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-4">
          <AskBox onAnswer={setAnswer} workspaceId={workspaceId} />
          <AnswerPanel result={answer} />
        </div>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-3 text-center text-xs text-zinc-400">
        Powered by Google Gemini · ChromaDB · Supabase · Hybrid BM25+Vector Search
      </footer>
    </div>
  );
}
