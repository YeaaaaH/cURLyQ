import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ChevronDown, Folder, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@/lib/http";
import {
  beforeZoneId,
  countNodes,
  endZoneId,
  locateNode,
  type Collection,
  type CollectionNode,
  type RequestNode,
} from "@/lib/collections";

// "2 folders and 5 requests" — used to word a delete confirmation before a
// cascading delete.
function describeCounts(counts: { folders: number; requests: number }): string {
  const parts: string[] = [];
  if (counts.folders > 0) parts.push(`${counts.folders} folder${counts.folders === 1 ? "" : "s"}`);
  if (counts.requests > 0) parts.push(`${counts.requests} request${counts.requests === 1 ? "" : "s"}`);
  return parts.join(" and ");
}

// Local, auto-focusing rename input — commits on blur or Enter, cancels
// (reverting to the original name) on Escape. Used for collections, folders,
// and requests alike since they all rename the same way.
function RenameInput({
  name,
  onCommit,
  onCancel,
}: {
  name: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed !== "") onCommit(trimmed);
    else onCancel();
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
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="h-6 flex-1 px-1 py-0 text-sm"
    />
  );
}

// Sits next to NodeMenu on every container row (collections and folders) as a
// one-click shortcut for the most common action — skips the "..." dropdown
// entirely for "New request", which the menu still offers too.
function QuickAddRequestButton({ onClick }: { onClick: () => void }) {
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

function NodeMenu({
  onNewFolder,
  onNewRequest,
  onRename,
  onDelete,
}: {
  onNewFolder?: () => void;
  onNewRequest?: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
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
        <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Every row is a drop target (drop something else onto it) and, by default,
// also a drag source (pick it up to move it) — pass `isDraggable={false}` to
// keep it droppable-only, used for collections: their *contents* (folders,
// requests) can be reordered/moved, but a collection itself isn't something
// you drag around — it stays a valid target for content dropped onto its
// root, just not pickup-able. Dropping onto a folder/collection nests the
// dragged node inside as the last child; dropping onto a request inserts the
// dragged node immediately before it. See `moveNodeRelativeToTarget` in
// lib/collections.ts for the actual tree surgery — this hook only wires up
// the DOM interaction.
//
// Deliberately does NOT apply `draggable.transform` to the source row: the
// row stays in normal flow inside an `overflow-y-auto` sidebar, and a CSS
// `transform` on an in-flow descendant counts toward its ancestor's
// scrollable-overflow region — dragging a row down was inflating the
// sidebar's scrollHeight and creating a phantom scrollbar. The dragged
// preview is rendered separately via `DragOverlay` (a portal to
// `document.body`, outside any scrollable ancestor) instead.
function useTreeDragAndDrop(id: string, disabled: boolean, isDraggable = true) {
  const draggable = useDraggable({ id, disabled: disabled || !isDraggable });
  const droppable = useDroppable({ id, disabled });
  return {
    setNodeRef: (el: HTMLElement | null) => {
      draggable.setNodeRef(el);
      droppable.setNodeRef(el);
    },
    attributes: draggable.attributes,
    listeners: draggable.listeners,
    isDragging: draggable.isDragging,
    isOver: droppable.isOver,
  };
}

// Sits just below the last item in a non-empty folder/collection — dropping
// on an existing row always means "insert before it," so without this
// there'd be no way to place something as the very last item short of
// dragging all the way up to the folder/collection's own header. Same
// destination as dropping on the header (see `endZoneId` in
// lib/collections.ts); just reachable from wherever the list currently ends.
//
// Collapsed to a hairline when idle and only grown to a comfortable drop
// target while a drag is actually in progress — always rendering it at full
// size added real bulk to the tree (on top of the row gap) even when nobody
// was dragging anything.
function EndDropZone({ containerId, depth, isDragActive }: { containerId: string; depth: number; isDragActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: endZoneId(containerId) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-t-2 transition-[height]",
        isDragActive ? "h-2" : "h-0.5",
        isOver ? "border-[#DA9100]/75" : "border-transparent"
      )}
      style={{ marginLeft: depth * 14 + 8 }}
    />
  );
}

// Sits just above a folder row — dropping directly on a folder always nests
// the dragged item inside it, which left no way to reposition two folders as
// *siblings*. Same drop-line treatment as the request-row indicator, just a
// standalone zone instead of a row's own border (folders already have their
// own border-driven hover state for the "nest inside" case). Same
// collapse-when-idle treatment as EndDropZone.
function BeforeDropZone({ nodeId, depth, isDragActive }: { nodeId: string; depth: number; isDragActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: beforeZoneId(nodeId) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-t-2 transition-[height]",
        isDragActive ? "h-2" : "h-0.5",
        isOver ? "border-[#DA9100]/75" : "border-transparent"
      )}
      style={{ marginLeft: depth * 14 + 8 }}
    />
  );
}

// Looks up the display info for the `DragOverlay` preview — a collection, a
// folder, or a request (which additionally shows its method badge).
function resolveDragPreview(
  collections: Collection[],
  id: string
): { name: string; method?: string } | null {
  const collection = collections.find((c) => c.id === id);
  if (collection) return { name: collection.name };
  const location = locateNode(collections, id);
  if (!location) return null;
  return location.node.type === "folder"
    ? { name: location.node.name }
    : { name: location.node.name, method: location.node.method };
}

interface TreeHandlers {
  renamingId: string | null;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  onOpenRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  onRenameNode: (collectionId: string, nodeId: string, name: string) => void;
  requestDeleteNode: (collectionId: string, node: CollectionNode) => void;
  isOpen: (id: string, defaultOpen: boolean) => boolean;
  setOpen: (id: string, open: boolean) => void;
  isDragActive: boolean;
}

function NodeRow({
  collectionId,
  node,
  depth,
  handlers,
}: {
  collectionId: string;
  node: CollectionNode;
  depth: number;
  handlers: TreeHandlers;
}) {
  const {
    renamingId,
    onStartRename,
    onCancelRename,
    onOpenRequest,
    onAddFolder,
    onAddRequest,
    onRenameNode,
    requestDeleteNode,
    isOpen,
    setOpen,
    isDragActive,
  } = handlers;
  const isRenaming = renamingId === node.id;
  const paddingLeft = depth * 14;
  const dnd = useTreeDragAndDrop(node.id, isRenaming);

  if (node.type === "folder") {
    return (
      <>
        <BeforeDropZone nodeId={node.id} depth={depth} isDragActive={isDragActive} />
        <Collapsible open={isOpen(node.id, false)} onOpenChange={(open) => setOpen(node.id, open)} className="flex flex-col">
          <div
            ref={dnd.setNodeRef}
            {...dnd.attributes}
            {...dnd.listeners}
            className={cn(
              "group/node flex shrink-0 items-center rounded-md",
              dnd.isDragging && "opacity-40",
              dnd.isOver && "bg-accent"
            )}
            style={{ paddingLeft }}
          >
            <CollapsibleTrigger
              disabled={isRenaming}
              className="group flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="flex w-8 shrink-0 items-center gap-0.5">
                <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                <Folder className="size-3.5 shrink-0" />
              </span>
              {isRenaming ? (
                <RenameInput
                  name={node.name}
                  onCommit={(name) => {
                    onRenameNode(collectionId, node.id, name);
                    onCancelRename();
                  }}
                  onCancel={onCancelRename}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
              )}
            </CollapsibleTrigger>
            <QuickAddRequestButton
              onClick={() => {
                onAddRequest(collectionId, node.id);
                setOpen(node.id, true);
              }}
            />
            <NodeMenu
              onNewFolder={() => {
                onStartRename(onAddFolder(collectionId, node.id));
                setOpen(node.id, true);
              }}
              onNewRequest={() => {
                onAddRequest(collectionId, node.id);
                setOpen(node.id, true);
              }}
              onRename={() => onStartRename(node.id)}
              onDelete={() => requestDeleteNode(collectionId, node)}
            />
          </div>
          <CollapsibleContent className="flex flex-col gap-0.5">
            {node.items.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 14 + 36 }}>
                Empty
              </p>
            ) : (
              <>
                {node.items.map((child) => (
                  <NodeRow key={child.id} collectionId={collectionId} node={child} depth={depth + 1} handlers={handlers} />
                ))}
                <EndDropZone containerId={node.id} depth={depth + 1} isDragActive={isDragActive} />
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </>
    );
  }

  return (
    <div
      ref={dnd.setNodeRef}
      {...dnd.attributes}
      {...dnd.listeners}
      className={cn(
        "group/node flex shrink-0 items-center rounded-md border-t-2",
        dnd.isDragging && "opacity-40",
        // Dropping on a request always means "insert before it" (see
        // moveNodeRelativeToTarget), so a line above the row shows exactly
        // where the dragged item will land — clearer than just highlighting
        // the whole row, which doesn't say "before" vs "inside." A toggled
        // border-top color (border-width always reserved) instead of an
        // absolutely-positioned overlay div — the latter renders at a
        // different sub-pixel Y-offset per row (depending on cumulative
        // scroll position) and visibly blurred to inconsistent thicknesses
        // on some rows; borders snap to the device pixel grid consistently.
        dnd.isOver ? "rounded-t-none border-[#DA9100]/75" : "border-transparent"
      )}
      style={{ paddingLeft }}
    >
      <button
        type="button"
        disabled={isRenaming}
        onClick={() => onOpenRequest(collectionId, node)}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-sm text-muted-foreground hover:text-foreground"
      >
        <span className={cn("w-8 shrink-0 text-[10px] font-semibold", METHOD_COLORS[node.method])}>
          {node.method}
        </span>
        {isRenaming ? (
          <RenameInput
            name={node.name}
            onCommit={(name) => {
              onRenameNode(collectionId, node.id, name);
              onCancelRename();
            }}
            onCancel={onCancelRename}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        )}
      </button>
      <NodeMenu
        onRename={() => onStartRename(node.id)}
        onDelete={() => requestDeleteNode(collectionId, node)}
      />
    </div>
  );
}

function CollectionRow({
  collection,
  isRenaming,
  isOpen,
  setOpen,
  setRenamingId,
  onRenameCollection,
  onRequestDeleteCollection,
  onAddFolder,
  onAddRequest,
  handlers,
}: {
  collection: Collection;
  isRenaming: boolean;
  isOpen: (id: string, defaultOpen: boolean) => boolean;
  setOpen: (id: string, open: boolean) => void;
  setRenamingId: (id: string | null) => void;
  onRenameCollection: (id: string, name: string) => void;
  onRequestDeleteCollection: () => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  handlers: TreeHandlers;
}) {
  const dnd = useTreeDragAndDrop(collection.id, isRenaming, false);

  return (
    <Collapsible
      open={isOpen(collection.id, true)}
      onOpenChange={(open) => setOpen(collection.id, open)}
      className="flex flex-col"
    >
      <div
        ref={dnd.setNodeRef}
        {...dnd.attributes}
        {...dnd.listeners}
        className={cn("group/node flex shrink-0 items-center rounded-md", dnd.isOver && "bg-accent")}
      >
        <CollapsibleTrigger
          disabled={isRenaming}
          className="group flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="flex w-8 shrink-0 items-center gap-0.5">
            <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
            <Folder className="size-3.5 shrink-0" />
          </span>
          {isRenaming ? (
            <RenameInput
              name={collection.name}
              onCommit={(name) => {
                onRenameCollection(collection.id, name);
                setRenamingId(null);
              }}
              onCancel={() => setRenamingId(null)}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{collection.name}</span>
          )}
        </CollapsibleTrigger>
        <QuickAddRequestButton
          onClick={() => {
            onAddRequest(collection.id, null);
            setOpen(collection.id, true);
          }}
        />
        <NodeMenu
          onNewFolder={() => {
            setRenamingId(onAddFolder(collection.id, null));
            setOpen(collection.id, true);
          }}
          onNewRequest={() => {
            onAddRequest(collection.id, null);
            setOpen(collection.id, true);
          }}
          onRename={() => setRenamingId(collection.id)}
          onDelete={onRequestDeleteCollection}
        />
      </div>
      <CollapsibleContent className="flex flex-col gap-0.5 pl-3">
        {collection.items.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Empty</p>
        ) : (
          <>
            {collection.items.map((node) => (
              <NodeRow key={node.id} collectionId={collection.id} node={node} depth={0} handlers={handlers} />
            ))}
            <EndDropZone containerId={collection.id} depth={0} isDragActive={handlers.isDragActive} />
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CollectionTree({
  collections,
  onRenameCollection,
  onDeleteCollection,
  onOpenRequest,
  onAddFolder,
  onAddRequest,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
}: {
  collections: Collection[];
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onOpenRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  onRenameNode: (collectionId: string, nodeId: string, name: string) => void;
  onDeleteNode: (collectionId: string, nodeId: string) => void;
  onMoveNode: (draggedId: string, targetId: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Which folders/collections are expanded, keyed by id — controlled (rather
  // than each Collapsible's own defaultOpen) so creating something inside a
  // container can force it open to reveal what was just added.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  function isOpen(id: string, defaultOpen: boolean): boolean {
    return openMap[id] ?? defaultOpen;
  }
  function setOpen(id: string, open: boolean) {
    setOpenMap((prev) => (prev[id] === open ? prev : { ...prev, [id]: open }));
  }

  // Only non-empty folders/collections get a confirmation — deleting a lone
  // request or an already-empty container is low-risk and stays instant.
  const [pendingDelete, setPendingDelete] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  function requestDeleteNode(collectionId: string, node: CollectionNode) {
    if (node.type === "folder" && node.items.length > 0) {
      const counts = countNodes(node.items);
      setPendingDelete({
        title: `Delete "${node.name}"?`,
        description: `This folder contains ${describeCounts(counts)}. Deleting it will permanently delete everything inside — this can't be undone.`,
        onConfirm: () => onDeleteNode(collectionId, node.id),
      });
      return;
    }
    onDeleteNode(collectionId, node.id);
  }

  function requestDeleteCollection(collection: Collection) {
    if (collection.items.length > 0) {
      const counts = countNodes(collection.items);
      setPendingDelete({
        title: `Delete "${collection.name}"?`,
        description: `This collection contains ${describeCounts(counts)}. Deleting it will permanently delete everything inside — this can't be undone.`,
        onConfirm: () => onDeleteCollection(collection.id),
      });
      return;
    }
    onDeleteCollection(collection.id);
  }

  // A small movement threshold before a press counts as a drag, so plain
  // clicks (open a request, expand a folder, hit a menu button) still work
  // normally — only a real drag exceeds it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handlers: TreeHandlers = {
    renamingId,
    onStartRename: setRenamingId,
    onCancelRename: () => setRenamingId(null),
    onOpenRequest,
    onAddFolder,
    onAddRequest,
    onRenameNode,
    requestDeleteNode,
    isOpen,
    setOpen,
    isDragActive: activeDragId !== null,
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onMoveNode(String(active.id), String(over.id));
    }
  }

  const dragPreview = activeDragId ? resolveDragPreview(collections, activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="flex flex-col gap-0.5">
        {collections.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No collections yet.</p>
        ) : (
          collections.map((collection) => (
            <CollectionRow
              key={collection.id}
              collection={collection}
              isRenaming={renamingId === collection.id}
              isOpen={isOpen}
              setOpen={setOpen}
              setRenamingId={setRenamingId}
              onRenameCollection={onRenameCollection}
              onRequestDeleteCollection={() => requestDeleteCollection(collection)}
              onAddFolder={onAddFolder}
              onAddRequest={onAddRequest}
              handlers={handlers}
            />
          ))
        )}
      </div>
      <DragOverlay>
        {dragPreview && (
          <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-md">
            {dragPreview.method ? (
              <span className={cn("w-8 shrink-0 text-[10px] font-semibold", METHOD_COLORS[dragPreview.method])}>
                {dragPreview.method}
              </span>
            ) : (
              <Folder className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{dragPreview.name}</span>
          </div>
        )}
      </DragOverlay>
      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDelete?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDelete?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                pendingDelete?.onConfirm();
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
