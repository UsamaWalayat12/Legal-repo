import uuid
from typing import Optional, List, Dict
from datetime import datetime, timezone
from supabase import create_client, Client

from app.config import settings

supabase: Optional[Client] = None


def get_supabase() -> Client:
    global supabase
    if supabase is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
            )
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return supabase


async def init_db():
    try:
        client = get_supabase()
        client.table("documents").select("id").limit(1).execute()
        print("Supabase connected successfully")
    except Exception as e:
        print(f"Warning: Could not connect to Supabase: {e}")
        print("Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env")


# ---------------------------------------------------------------------------
# Workspace helpers
# ---------------------------------------------------------------------------

def list_workspaces(user_id: str) -> List[Dict]:
    client = get_supabase()
    result = (
        client.table("workspaces")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data


def create_workspace(user_id: str, name: str) -> Dict:
    client = get_supabase()
    data = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("workspaces").insert(data).execute()
    return result.data[0]


def get_workspace(workspace_id: str, user_id: str) -> Optional[Dict]:
    client = get_supabase()
    result = (
        client.table("workspaces")
        .select("*")
        .eq("id", workspace_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


def delete_workspace_record(workspace_id: str, user_id: str):
    client = get_supabase()
    client.table("workspaces").delete().eq("id", workspace_id).eq("user_id", user_id).execute()


# ---------------------------------------------------------------------------
# Document helpers  (all scoped to user_id + workspace_id)
# ---------------------------------------------------------------------------

def create_document(
    file_name: str,
    doc_type: str,
    workspace_id: str = "default",
    user_id: str = "dev-user",
) -> Dict:
    client = get_supabase()
    doc_id = str(uuid.uuid4())
    data = {
        "id": doc_id,
        "file_name": file_name,
        "doc_type": doc_type,
        "upload_date": datetime.now(timezone.utc).isoformat(),
        "page_count": 0,
        "status": "processing",
        "workspace_id": workspace_id,
    }
    # user_id column requires migration — add it only if it exists
    # Run: ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id uuid;
    try:
        data["user_id"] = user_id
        result = client.table("documents").insert(data).execute()
    except Exception as e:
        if "user_id" in str(e):
            # Column not migrated yet — insert without user_id
            data.pop("user_id", None)
            result = client.table("documents").insert(data).execute()
        else:
            raise
    return result.data[0]


def update_document_status(
    doc_id: str,
    status: str,
    page_count: int = 0,
    error_message: Optional[str] = None,
):
    client = get_supabase()
    data: Dict = {"status": status, "page_count": page_count}
    if error_message:
        data["error_message"] = error_message
    client.table("documents").update(data).eq("id", doc_id).execute()


def list_documents(
    user_id: str = "dev-user",
    workspace_id: Optional[str] = None,
) -> List[Dict]:
    client = get_supabase()
    query = (
        client.table("documents")
        .select("*")
        .eq("user_id", user_id)
        .order("upload_date", desc=True)
    )
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)
    result = query.execute()
    return result.data


def get_document(doc_id: str) -> Optional[Dict]:
    client = get_supabase()
    result = client.table("documents").select("*").eq("id", doc_id).execute()
    return result.data[0] if result.data else None


def delete_document_record(doc_id: str):
    client = get_supabase()
    client.table("documents").delete().eq("id", doc_id).execute()


# ---------------------------------------------------------------------------
# Chunk helpers
# ---------------------------------------------------------------------------

def create_chunks(chunks: List[Dict]) -> List[Dict]:
    client = get_supabase()
    for c in chunks:
        c["id"] = str(uuid.uuid4())
    result = client.table("chunks").insert(chunks).execute()
    return result.data


def delete_chunks_by_document(doc_id: str):
    client = get_supabase()
    client.table("chunks").delete().eq("document_id", doc_id).execute()
