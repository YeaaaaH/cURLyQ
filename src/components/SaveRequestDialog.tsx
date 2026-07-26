import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Folder, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Collection, CollectionNode } from "@/lib/collections";

// The dialog's notion of "where to save" — a collection root (parentFolderId
// null) or a specific folder nested inside one.
interface Target {
  collectionId: string;
  parentFolderId: string | null;
}

function sameTarget(a: Target | null, b: Target): boolean {
  return a !== null && a.collectionId === b.collectionId && a.parentFolderId === b.parentFolderId;
}

// One row per folder (requests aren't valid save targets, so they're skipped
// entirely — only collections/folders render). Recurses into subfolders.
function FolderRows({
  collectionId,
  nodes,
  depth,
  selected,
  onSelect,
}: {
  collectionId: string;
  nodes: CollectionNode[];
  depth: number;
  selected: Target | null;
  onSelect: (target: Target) => void;
}) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  return (
    <>
      {nodes
        .filter((node): node is Extract<CollectionNode, { type: "folder" }> => node.type === "folder")
        .map((folder) => {
          const isOpen = openMap[folder.id] ?? false;
          const target: Target = { collectionId, parentFolderId: folder.id };
          return (
            <div key={folder.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => onSelect(target)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-1 py-1 text-left text-sm hover:bg-accent",
                  sameTarget(selected, target) ? "bg-accent text-foreground" : "text-muted-foreground"
                )}
                style={{ paddingLeft: depth * 14 + 4 }}
              >
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMap((prev) => ({ ...prev, [folder.id]: !isOpen }));
                  }}
                  className="flex shrink-0 items-center"
                >
                  {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                </span>
                <Folder className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              </button>
              {isOpen && (
                <FolderRows
                  collectionId={collectionId}
                  nodes={folder.items}
                  depth={depth + 1}
                  selected={selected}
                  onSelect={onSelect}
                />
              )}
            </div>
          );
        })}
    </>
  );
}

export function SaveRequestDialog({
  open,
  onOpenChange,
  collections,
  defaultName,
  onAddCollection,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: Collection[];
  defaultName: string;
  onAddCollection: () => string;
  onConfirm: (collectionId: string, parentFolderId: string | null, name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [selected, setSelected] = useState<Target | null>(null);

  // Reset the draft name and selection each time the dialog opens, rather
  // than carrying over whatever was left from the last time it was used.
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSelected(null);
    }
  }, [open, defaultName]);

  function handleAddCollection() {
    const id = onAddCollection();
    setSelected({ collectionId: id, parentFolderId: null });
  }

  function handleConfirm() {
    if (!selected || name.trim() === "") return;
    onConfirm(selected.collectionId, selected.parentFolderId, name.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save request</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="save-request-name" className="text-sm text-muted-foreground">
            Request name
          </label>
          <Input id="save-request-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Save to</span>
            <Button type="button" variant="ghost" size="sm" onClick={handleAddCollection} className="gap-1.5">
              <FolderPlus className="size-3.5" />
              New collection
            </Button>
          </div>
          <div className="scrollbar-thin flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-md border border-input p-1">
            {collections.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No collections yet — create one to save into.
              </p>
            ) : (
              collections.map((collection) => {
                const target: Target = { collectionId: collection.id, parentFolderId: null };
                return (
                  <div key={collection.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setSelected(target)}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-1 py-1 text-left text-sm font-medium hover:bg-accent",
                        sameTarget(selected, target) ? "bg-accent text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <Folder className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{collection.name}</span>
                    </button>
                    <FolderRows
                      collectionId={collection.id}
                      nodes={collection.items}
                      depth={1}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selected || name.trim() === ""}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
