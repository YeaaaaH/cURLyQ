import { DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@/lib/http";
import { beforeZoneId, endZoneId, locateNode, type Collection } from "@/lib/collections";
import { ACTIVE_DROP_BORDER_CLASS, DROP_ZONE_OFFSET_PX, TREE_INDENT_PX } from "./constants";

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
// Deliberately does NOT apply `draggable.transform` to the source row: a CSS
// transform on this in-flow row counts toward the sidebar's scrollable
// overflow, inflating scrollHeight into a phantom scrollbar while dragging.
// The dragged preview is rendered separately via `TreeDragOverlay` (a portal
// to `document.body`, outside any scrollable ancestor) instead.
export function useTreeDragAndDrop(id: string, disabled: boolean, isDraggable = true) {
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

interface EndDropZoneProps {
  containerId: string;
  depth: number;
  isDragActive: boolean;
}

// Sits just below the last item in a non-empty folder/collection — dropping
// on an existing row always means "insert before it," so without this
// there'd be no way to place something as the very last item short of
// dragging all the way up to the folder/collection's own header. Collapsed
// to a hairline when idle and only grown to a full drop target while a drag
// is actually in progress, to avoid adding permanent bulk to the tree.
export function EndDropZone({ containerId, depth, isDragActive }: EndDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: endZoneId(containerId) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-t-2 transition-[height]",
        isDragActive ? "h-2" : "h-0.5",
        isOver ? ACTIVE_DROP_BORDER_CLASS : "border-transparent"
      )}
      style={{ marginLeft: depth * TREE_INDENT_PX + DROP_ZONE_OFFSET_PX }}
    />
  );
}

interface BeforeDropZoneProps {
  nodeId: string;
  depth: number;
  isDragActive: boolean;
}

// Sits just above a folder row — dropping directly on a folder always nests
// the dragged item inside it, which left no way to reposition two folders as
// *siblings*. Same collapse-when-idle treatment as EndDropZone.
export function BeforeDropZone({ nodeId, depth, isDragActive }: BeforeDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: beforeZoneId(nodeId) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-t-2 transition-[height]",
        isDragActive ? "h-2" : "h-0.5",
        isOver ? ACTIVE_DROP_BORDER_CLASS : "border-transparent"
      )}
      style={{ marginLeft: depth * TREE_INDENT_PX + DROP_ZONE_OFFSET_PX }}
    />
  );
}

export interface DragPreviewInfo {
  name: string;
  method?: string;
}

// Resolves what's currently being dragged (a collection, a folder, or a
// request, which additionally shows its method badge) into display info for
// the DragOverlay preview.
export function resolveDragPreview(collections: readonly Collection[], id: string): DragPreviewInfo | null {
  const collection = collections.find((c) => c.id === id);
  if (collection) return { name: collection.name };
  const location = locateNode(collections as Collection[], id);
  if (!location) return null;
  return location.node.type === "folder"
    ? { name: location.node.name }
    : { name: location.node.name, method: location.node.method };
}

interface TreeDragOverlayProps {
  preview: DragPreviewInfo | null;
}

export function TreeDragOverlay({ preview }: TreeDragOverlayProps) {
  return (
    <DragOverlay>
      {preview && (
        <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-md">
          {preview.method ? (
            <span
              className={cn(
                "w-8 shrink-0 overflow-hidden text-[9px] font-semibold tracking-tighter",
                METHOD_COLORS[preview.method]
              )}
            >
              {preview.method}
            </span>
          ) : (
            <Folder className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{preview.name}</span>
        </div>
      )}
    </DragOverlay>
  );
}
