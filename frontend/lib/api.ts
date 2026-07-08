const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Auth token storage
// ---------------------------------------------------------------------------
let _token: string | null = null;

// Callback registered by AuthContext to handle forced logout on 401
let _onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn;
}

export function setAuthToken(token: string | null) {
  _token = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("lexintel_token", token);
    else localStorage.removeItem("lexintel_token");
  }
}

export function getAuthToken(): string | null {
  if (_token) return _token;
  if (typeof window !== "undefined") {
    _token = localStorage.getItem("lexintel_token");
  }
  return _token;
}

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------
async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    // On 401: clear token and call the logout handler registered by AuthContext
    // Do NOT reload — let React state handle the redirect to login screen
    if (res.status === 401) {
      setAuthToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("lexintel_user");
      }
      _onUnauthorized?.();
    }
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Document {
  id: string;
  file_name: string;
  doc_type: string;
  upload_date: string;
  page_count: number;
  status: string;
  workspace_id: string | null;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  doc_name: string;
  page_number: number;
  chunk_index: number;
  text: string;
  score: number;
  vector_score?: number;
  bm25_score?: number;
}

export interface Citation {
  marker: string;
  doc_name: string;
  page_number: number;
  chunk_id: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  insufficient_evidence: boolean;
  retrieved_chunks: SearchResult[];
}

// ---------------------------------------------------------------------------
// Auth (Supabase Auth REST)
// ---------------------------------------------------------------------------

export interface AuthResponse {
  access_token: string;
  user: { id: string; email: string };
}

async function supabaseAuthRequest(
  endpoint: string,
  body: object
): Promise<AuthResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.message || "Auth failed");
  }
  return data as AuthResponse;
}

export async function signUp(email: string, password: string): Promise<AuthResponse> {
  return supabaseAuthRequest("signup", { email, password });
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  return supabaseAuthRequest("token?grant_type=password", { email, password });
}

export function signOut() {
  setAuthToken(null);
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export async function listWorkspaces(): Promise<Workspace[]> {
  return fetchAPI<Workspace[]>("/workspaces");
}

export async function createWorkspace(name: string): Promise<Workspace> {
  return fetchAPI<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await fetchAPI(`/workspaces/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function uploadDocument(
  file: File,
  docType?: string,
  workspaceId?: string
): Promise<Document> {
  const token = getAuthToken();
  const form = new FormData();
  form.append("file", file);
  if (docType) form.append("doc_type", docType);
  if (workspaceId) form.append("workspace_id", workspaceId);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    if (res.status === 401) {
      setAuthToken(null);
      if (typeof window !== "undefined") localStorage.removeItem("lexintel_user");
      _onUnauthorized?.();
    }
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listDocuments(workspaceId?: string): Promise<Document[]> {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : "";
  return fetchAPI<Document[]>(`/documents${params}`);
}

export async function deleteDocument(id: string): Promise<void> {
  await fetchAPI(`/documents/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Search & Ask
// ---------------------------------------------------------------------------

export async function search(
  query: string,
  topK?: number,
  docType?: string,
  workspaceId?: string
): Promise<{ results: SearchResult[] }> {
  return fetchAPI<{ results: SearchResult[] }>("/search", {
    method: "POST",
    body: JSON.stringify({ query, top_k: topK, doc_type: docType, workspace_id: workspaceId }),
  });
}

export async function ask(
  question: string,
  docType?: string,
  workspaceId?: string
): Promise<AskResponse> {
  return fetchAPI<AskResponse>("/ask", {
    method: "POST",
    body: JSON.stringify({ question, doc_type: docType, workspace_id: workspaceId }),
  });
}
