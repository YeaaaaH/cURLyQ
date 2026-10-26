import { DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@/lib/http";
import { beforeZoneId, endZoneId, locateNode, type Collection } from "@/lib/collections";
import { ACTIVE_DROP_BORDER_CLASS, DROP_ZONE_OFFSET_PX, TREE_INDENT_PX } from "./constants";

// No `draggable.transform` on the source row: it inflates the sidebar's scrollHeight
// into a phantom scrollbar. The preview is rendered via TreeDragOverlay instead.
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
                "w-8 shrink-0 overflow-hidden text-center text-[9px] font-semibold tracking-tighter",
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
