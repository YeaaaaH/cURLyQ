import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Folder, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import type { PendingDelete } from "./types";

interface RenameInputProps {
  name: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

// Local, auto-focusing rename input — commits on blur or Enter (Enter just
// blurs, so blur is the single commit path), cancels (reverting to the
// original name) on Escape. Used for collections, folders, and requests
// alike since they all rename the same way.
export function RenameInput({ name, onCommit, onCancel }: RenameInputProps) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against commit() running twice — e.g. Enter blurs the input,
  // which would otherwise also fire onBlur's own commit().
  const finishedRef = useRef(false);

  useEffect(() => {
    setDraft(name);
    inputRef.current?.select();
  }, [name]);

  function commit() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  }

  function cancel() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCancel();
  }

  return (
    <Input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      className="h-6 flex-1 px-1 py-0 text-sm"
    />
  );
}

interface QuickAddRequestButtonProps {
  onClick: () => void;
}

// Sits next to NodeMenu on every container row (collections and folders) as a
// one-click shortcut for the most common action — skips the "..." dropdown
// entirely for "New request", which the menu still offers too.
export function QuickAddRequestButton({ onClick }: QuickAddRequestButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="New request"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="mr-0.5 shrink-0 text-muted-foreground opacity-0 group-hover/node:opacity-100"
    >
      <Plus className="size-3.5" />
    </Button>
  );
}

interface NodeMenuProps {
  onNewFolder?: () => void;
  onNewRequest?: () => void;
  onRun?: () => void;
  onRename: () => void;
  onExport?: () => void;
  onDelete: () => void;
}

export function NodeMenu({ onNewFolder, onNewRequest, onRun, onRename, onExport, onDelete }: NodeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Node options"
          onClick={(e) => e.stopPropagation()}
          className="mr-0.5 shrink-0 text-muted-foreground opacity-0 group-hover/node:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {onNewFolder && (
          <DropdownMenuItem onClick={onNewFolder}>
            <Folder className="size-3.5" />
            New folder
          </DropdownMenuItem>
        )}
        {onNewRequest && (
          <DropdownMenuItem onClick={onNewRequest}>
            <Plus className="size-3.5" />
            New request
          </DropdownMenuItem>
        )}
        {onRun && (
          <DropdownMenuItem onClick={onRun}>
            <Play className="size-3.5" />
            Run
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="size-3.5" />
          Rename
        </DropdownMenuItem>
        {onExport && (
          <DropdownMenuItem onClick={onExport}>
            <Download className="size-3.5" />
            Export...
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DeleteConfirmationDialogProps {
  pendingDelete: PendingDelete | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmation gate for a cascading delete — only shown for non-empty
// folders/collections (see requestDeleteNode/requestDeleteCollection in
// CollectionTree.tsx), since deleting a lone request or an already-empty
// container is low-risk and stays instant.
export function DeleteConfirmationDialog({ pendingDelete, onConfirm, onCancel }: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pendingDelete?.title}</AlertDialogTitle>
          <AlertDialogDescription>{pendingDelete?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
