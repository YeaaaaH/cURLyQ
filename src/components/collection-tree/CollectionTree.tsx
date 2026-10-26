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

const NO_REVEAL_IDS: ReadonlySet<string> = new Set();

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

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
  onDuplicateCollection: (id: string) => void;
  onOpenRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  onRunNode: (collectionId: string, node: CollectionNode) => void;
  onRenameNode: (collectionId: string, nodeId: string, name: string) => void;
  onDuplicateNode: (nodeId: string) => void;
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
  onDuplicateCollection,
  onOpenRequest,
  onAddFolder,
  onAddRequest,
  onRunNode,
  onRenameNode,
  onDuplicateNode,
  onDeleteNode,
  onMoveNode,
  runningId,
}: CollectionTreeProps) {
  const treeState = useCollectionTreeState();

  // Never written to persisted expand state, so clearing the query restores it.
  const revealIds = useMemo(
    () => (query.trim() !== "" ? collectContainerIds(collections) : NO_REVEAL_IDS),
    [collections, query]
  );

  // Lets a force-revealed container still be closed. Reset during render, not in an
  // effect, so it lands in the same commit as the new revealIds.
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

  // Movement threshold so plain clicks aren't treated as drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

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
    onDuplicateNode,
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
              onDuplicateCollection={onDuplicateCollection}
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
