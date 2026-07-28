import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { countNodes, type Collection, type CollectionNode, type RequestNode } from "@/lib/collections";
import { CollectionRow } from "./TreeRows";
import { resolveDragPreview, TreeDragOverlay } from "./TreeDragAndDrop";
import { DeleteConfirmationDialog } from "./TreeControls";
import { useCollectionTreeState } from "./useCollectionTreeState";
import type { PendingDelete, TreeHandlers } from "./types";

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
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onExportCollection: (id: string) => void;
  onOpenRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  onRenameNode: (collectionId: string, nodeId: string, name: string) => void;
  onDeleteNode: (collectionId: string, nodeId: string) => void;
  onMoveNode: (draggedId: string, targetId: string) => void;
}

export function CollectionTree({
  collections,
  onRenameCollection,
  onDeleteCollection,
  onExportCollection,
  onOpenRequest,
  onAddFolder,
  onAddRequest,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
}: CollectionTreeProps) {
  const treeState = useCollectionTreeState();

  // Only non-empty folders/collections get a confirmation — deleting a lone
  // request or an already-empty container is low-risk and stays instant.
  // Explicit + serializable rather than a stored callback, so confirming is
  // deterministic and doesn't depend on a closure captured at request time.
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  function requestDeleteNode(collectionId: string, node: CollectionNode) {
    if (node.type === "folder" && node.items.length > 0) {
      const counts = countNodes(node.items);
      setPendingDelete({
        type: "node",
        collectionId,
        nodeId: node.id,
        title: `Delete "${node.name}"?`,
        description: `This folder contains ${describeCounts(counts)}. Deleting it will permanently delete everything inside — this can't be undone.`,
      });
      return;
    }
    onDeleteNode(collectionId, node.id);
  }

  function requestDeleteCollection(collection: Collection) {
    if (collection.items.length > 0) {
      const counts = countNodes(collection.items);
      setPendingDelete({
        type: "collection",
        collectionId: collection.id,
        title: `Delete "${collection.name}"?`,
        description: `This collection contains ${describeCounts(counts)}. Deleting it will permanently delete everything inside — this can't be undone.`,
      });
      return;
    }
    onDeleteCollection(collection.id);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === "collection") {
      onDeleteCollection(pendingDelete.collectionId);
    } else {
      onDeleteNode(pendingDelete.collectionId, pendingDelete.nodeId);
    }
    setPendingDelete(null);
  }

  // A small movement threshold before a press counts as a drag, so plain
  // clicks (open a request, expand a folder, hit a menu button) still work
  // normally — only a real drag exceeds it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const handlers: TreeHandlers = {
    renamingId: treeState.renamingId,
    onStartRename: treeState.startRenaming,
    onCancelRename: treeState.cancelRenaming,
    onOpenRequest,
    onAddFolder,
    onAddRequest,
    onRenameNode,
    requestDeleteNode,
    isOpen: treeState.isOpen,
    setOpen: treeState.setOpen,
    isDragActive: draggedNodeId !== null,
  };

  function handleDragStart(event: DragStartEvent) {
    setDraggedNodeId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
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
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggedNodeId(null)}
    >
      <div className="flex flex-col gap-0.5">
        {collections.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No collections yet.</p>
        ) : (
          collections.map((collection) => (
            <CollectionRow
              key={collection.id}
              collection={collection}
              isRenaming={treeState.renamingId === collection.id}
              isOpen={treeState.isOpen}
              setOpen={treeState.setOpen}
              onStartRename={treeState.startRenaming}
              onCancelRename={treeState.cancelRenaming}
              onRenameCollection={onRenameCollection}
              onRequestDeleteCollection={() => requestDeleteCollection(collection)}
              onExportCollection={onExportCollection}
              onAddFolder={onAddFolder}
              onAddRequest={onAddRequest}
              handlers={handlers}
            />
          ))
        )}
      </div>
      <TreeDragOverlay preview={dragPreview} />
      <DeleteConfirmationDialog pendingDelete={pendingDelete} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
    </DndContext>
  );
}
