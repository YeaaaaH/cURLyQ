import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  collectAllNodeIds,
  collectContainerIds,
  countNodes,
  locateNode,
  type Collection,
  type CollectionNode,
  type RequestNode,
} from "@/lib/collections";
import { CollectionRow } from "./TreeRows";
import { resolveDragPreview, TreeDragOverlay } from "./TreeDragAndDrop";
import { DeleteConfirmationDialog } from "./TreeControls";
import { useCollectionTreeState } from "./useCollectionTreeState";
import type { PendingDelete, TreeHandlers } from "./types";

const DRAG_EXPAND_DWELL_MS = 600;

// Stable empty set so a blank query doesn't allocate (or force any renders
// off) a new reveal set every render.
const NO_REVEAL_IDS: ReadonlySet<string> = new Set();

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// "2 folders and 5 requests" — used to word a delete confirmation before a
// cascading delete.
function describeCounts(counts: { folders: number; requests: number }): string {
  return [
    counts.folders > 0 ? pluralize(counts.folders, "folder") : null,
    counts.requests > 0 ? pluralize(counts.requests, "request") : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" and ");
}

interface CollectionTreeProps {
  collections: readonly Collection[];
  query: string;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onRunCollection: (id: string) => void;
  onExportCollection: (id: string) => void;
  onOpenRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  onRunNode: (collectionId: string, node: CollectionNode) => void;
  onRenameNode: (collectionId: string, nodeId: string, name: string) => void;
  onDeleteNode: (collectionId: string, nodeId: string) => void;
  onMoveNode: (draggedId: string, targetId: string) => void;
  runningId: string | null;
}

export function CollectionTree({
  collections,
  query,
  onRenameCollection,
  onDeleteCollection,
  onRunCollection,
  onExportCollection,
  onOpenRequest,
  onAddFolder,
  onAddRequest,
  onRunNode,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
  runningId,
}: CollectionTreeProps) {
  const treeState = useCollectionTreeState();

  // Ephemeral, fresh per keystroke, and never written back to treeState's
  // persisted expand state — clearing the query reverts to exactly whatever
  // was expanded before searching.
  const revealIds = useMemo(
    () => (query.trim() !== "" ? collectContainerIds(collections) : NO_REVEAL_IDS),
    [collections, query]
  );

  // A revealed container still needs to be manually closable — otherwise a
  // click on its chevron while searching visibly does nothing, since it'd
  // stay force-opened by revealIds regardless. Tracks ids the user
  // explicitly closed while they were force-opened, ephemeral like revealIds
  // itself: reset on every keystroke ("adjusting state during render" rather
  // than an effect, so the reset lands in the same commit as the new
  // query's revealIds instead of flashing open-then-closed a frame later).
  const [collapsedReveals, setCollapsedReveals] = useState<ReadonlySet<string>>(NO_REVEAL_IDS);
  const [queryAtLastReset, setQueryAtLastReset] = useState(query);
  if (query !== queryAtLastReset) {
    setQueryAtLastReset(query);
    setCollapsedReveals(NO_REVEAL_IDS);
  }

  const isOpen = useCallback(
    (id: string, defaultOpen: boolean) =>
      revealIds.has(id) ? !collapsedReveals.has(id) : treeState.isOpen(id, defaultOpen),
    [revealIds, collapsedReveals, treeState.isOpen]
  );

  const setOpen = useCallback(
    (id: string, open: boolean) => {
      if (revealIds.has(id)) {
        setCollapsedReveals((current) => {
          const next = new Set(current);
          if (open) next.delete(id);
          else next.add(id);
          return next;
        });
        return;
      }
      treeState.setOpen(id, open);
    },
    [revealIds, treeState.setOpen]
  );

  // Only non-empty folders/collections get a confirmation — deleting a lone
  // request or an already-empty container is low-risk and stays instant.
  // Explicit + serializable rather than a stored callback, so confirming is
  // deterministic and doesn't depend on a closure captured at request time.
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  function requestDeleteNode(collectionId: string, node: CollectionNode) {
    const idsToForget = collectAllNodeIds(node);
    if (node.type === "folder" && node.items.length > 0) {
      const counts = countNodes(node.items);
      setPendingDelete({
        type: "node",
        collectionId,
        nodeId: node.id,
        title: `Delete "${node.name}"?`,
        description: `This folder contains ${describeCounts(counts)}. Deleting it will permanently delete everything inside — this can't be undone.`,
        idsToForget,
      });
      return;
    }
    onDeleteNode(collectionId, node.id);
    treeState.forgetIds(idsToForget);
  }

  function requestDeleteCollection(collection: Collection) {
    const idsToForget = [collection.id, ...collection.items.flatMap(collectAllNodeIds)];
    if (collection.items.length > 0) {
      const counts = countNodes(collection.items);
      setPendingDelete({
        type: "collection",
        collectionId: collection.id,
        title: `Delete "${collection.name}"?`,
        description: `This collection contains ${describeCounts(counts)}. Deleting it will permanently delete everything inside — this can't be undone.`,
        idsToForget,
      });
      return;
    }
    onDeleteCollection(collection.id);
    treeState.forgetIds(idsToForget);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === "collection") {
      onDeleteCollection(pendingDelete.collectionId);
    } else {
      onDeleteNode(pendingDelete.collectionId, pendingDelete.nodeId);
    }
    treeState.forgetIds(pendingDelete.idsToForget);
    setPendingDelete(null);
  }

  // A small movement threshold before a press counts as a drag, so plain
  // clicks (open a request, expand a folder, hit a menu button) still work
  // normally — only a real drag exceeds it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // Dwell-to-expand: hovering a drag over a closed folder/collection for
  // DRAG_EXPAND_DWELL_MS opens it, so dropping *into* a collapsed container
  // doesn't require manually opening it first mid-drag. Only fires for a
  // container's own droppable id (a "nest inside" target, per
  // TreeDragAndDrop.tsx) — not the before/end reorder drop-zones, and not a
  // container that's already open.
  const dwellTimerRef = useRef<number | null>(null);
  const dwellTargetIdRef = useRef<string | null>(null);

  function clearDwell() {
    if (dwellTimerRef.current !== null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    dwellTargetIdRef.current = null;
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null;
    if (overId === dwellTargetIdRef.current) return;
    clearDwell();
    if (overId === null || isOpen(overId, false)) return;

    const isCollection = collections.some((c) => c.id === overId);
    const location = isCollection ? null : locateNode(collections as Collection[], overId);
    if (!isCollection && location?.node.type !== "folder") return;

    dwellTargetIdRef.current = overId;
    dwellTimerRef.current = window.setTimeout(() => setOpen(overId, true), DRAG_EXPAND_DWELL_MS);
  }

  const handlers: TreeHandlers = {
    query,
    renamingId: treeState.renamingId,
    onStartRename: treeState.startRenaming,
    onCancelRename: treeState.cancelRenaming,
    onOpenRequest,
    onAddFolder,
    onAddRequest,
    onRunNode,
    onRenameNode,
    requestDeleteNode,
    isOpen,
    setOpen,
    isDragActive: draggedNodeId !== null,
    runningId,
  };

  function handleDragStart(event: DragStartEvent) {
    setDraggedNodeId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    clearDwell();
    setDraggedNodeId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onMoveNode(String(active.id), String(over.id));
    }
  }

  const dragPreview = draggedNodeId ? resolveDragPreview(collections, draggedNodeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        clearDwell();
        setDraggedNodeId(null);
      }}
    >
      <div className="flex flex-col gap-0.5">
        {collections.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            {query.trim() !== "" ? `No matches for "${query.trim()}".` : "No collections yet."}
          </p>
        ) : (
          collections.map((collection) => (
            <CollectionRow
              key={collection.id}
              collection={collection}
              isRenaming={treeState.renamingId === collection.id}
              isOpen={isOpen}
              setOpen={setOpen}
              onStartRename={treeState.startRenaming}
              onCancelRename={treeState.cancelRenaming}
              onRenameCollection={onRenameCollection}
              onRequestDeleteCollection={() => requestDeleteCollection(collection)}
              onRunCollection={onRunCollection}
              onExportCollection={onExportCollection}
              onAddFolder={onAddFolder}
              onAddRequest={onAddRequest}
              handlers={handlers}
              runningId={runningId}
            />
          ))
        )}
      </div>
      <TreeDragOverlay preview={dragPreview} />
      <DeleteConfirmationDialog pendingDelete={pendingDelete} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
    </DndContext>
  );
}
