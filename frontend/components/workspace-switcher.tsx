"use client";
import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listWorkspaces,
  createWorkspace,
  deleteWorkspace,
  getAuthToken,
  type Workspace,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface WorkspaceSwitcherProps {
  currentWorkspaceId: string | null;
  onSelect: (id: string | null, name: string) => void;
}

export function WorkspaceSwitcher({ currentWorkspaceId, onSelect }: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const load = useCallback(async () => {
    // Don't call API if not authenticated
    if (!getAuthToken()) return;
    try {
      const ws = await listWorkspaces();
      setWorkspaces(ws);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ws = await createWorkspace(newName.trim());
      setWorkspaces((prev) => [...prev, ws]);
      setNewName("");
      setShowInput(false);
      onSelect(ws.id, ws.name);
      toast({ title: `Workspace "${ws.name}" created` });
    } catch (err: unknown) {
      toast({
        title: "Failed to create workspace",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (ws: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteWorkspace(ws.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
      if (currentWorkspaceId === ws.id) onSelect(null, "All Documents");
      toast({ title: `Workspace "${ws.name}" deleted` });
    } catch (err: unknown) {
      toast({
        title: "Failed to delete workspace",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const currentName =
    currentWorkspaceId
      ? workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? "Workspace"
      : "All Documents";

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2 truncate">
          <FolderOpen className="h-4 w-4 shrink-0 text-zinc-500" />
          <span className="truncate">{currentName}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
          {/* All Documents */}
          <button
            className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50"
            onClick={() => { onSelect(null, "All Documents"); setOpen(false); }}
          >
            <span className="text-zinc-700">All Documents</span>
            {!currentWorkspaceId && <Badge variant="secondary">active</Badge>}
          </button>

          {workspaces.length > 0 && (
            <div className="border-t border-zinc-100">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50"
                  onClick={() => { onSelect(ws.id, ws.name); setOpen(false); }}
                >
                  <span className="truncate text-zinc-700">{ws.name}</span>
                  <span className="flex items-center gap-1.5">
                    {currentWorkspaceId === ws.id && <Badge variant="secondary">active</Badge>}
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      onClick={(e) => handleDelete(ws, e)}
                      onKeyDown={(e) => e.key === "Enter" && handleDelete(ws, e as unknown as React.MouseEvent)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Create new workspace */}
          <div className="border-t border-zinc-100 p-2">
            {showInput ? (
              <div className="flex gap-1.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Workspace name"
                  className="h-7 text-xs"
                  autoFocus
                />
                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreate} disabled={creating}>
                  {creating ? "..." : "Add"}
                </Button>
              </div>
            ) : (
              <button
                className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                onClick={() => setShowInput(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
