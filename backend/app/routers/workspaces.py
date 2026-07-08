from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.schemas import WorkspaceCreate, WorkspaceResponse
from app.db.session import (
    list_workspaces,
    create_workspace,
    get_workspace,
    delete_workspace_record,
)

router = APIRouter()


@router.get("", response_model=list[WorkspaceResponse])
async def get_workspaces(user_id: str = Depends(get_current_user)):
    return list_workspaces(user_id)


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def new_workspace(
    body: WorkspaceCreate,
    user_id: str = Depends(get_current_user),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Workspace name cannot be empty")
    return create_workspace(user_id, body.name.strip())


@router.delete("/{workspace_id}")
async def remove_workspace(
    workspace_id: str,
    user_id: str = Depends(get_current_user),
):
    ws = get_workspace(workspace_id, user_id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    delete_workspace_record(workspace_id, user_id)
    return {"message": "Workspace deleted"}
