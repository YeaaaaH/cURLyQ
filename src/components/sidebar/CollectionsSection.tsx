import type { RefObject } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { Collection, RequestNode } from "@/lib/collections";
import { CollectionTree } from "@/components/collection-tree/CollectionTree";

interface CollectionsSectionProps {
  wrapperRef: RefObject<HTMLDivElement | null>;
  height: number | null;
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

export function CollectionsSection({
  wrapperRef,
  height,
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
}: CollectionsSectionProps) {
  return (
    <div
      ref={wrapperRef}
      className="flex min-h-0 max-h-[50%] shrink flex-col"
      style={height !== null ? { height, maxHeight: height, flexShrink: 0 } : undefined}
    >
      <Collapsible defaultOpen className="flex min-h-0 flex-1 flex-col">
        <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
          Collections
        </CollapsibleTrigger>
        <CollapsibleContent className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pl-3">
          <CollectionTree
            collections={collections}
            onRenameCollection={onRenameCollection}
            onDeleteCollection={onDeleteCollection}
            onExportCollection={onExportCollection}
            onOpenRequest={onOpenRequest}
            onAddFolder={onAddFolder}
            onAddRequest={onAddRequest}
            onRenameNode={onRenameNode}
            onDeleteNode={onDeleteNode}
            onMoveNode={onMoveNode}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
