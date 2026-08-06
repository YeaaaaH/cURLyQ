import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Collection, CollectionNode, RequestNode } from "@/lib/collections";
import { CollectionTree } from "@/components/collection-tree/CollectionTree";
import { usePersistedBoolean } from "@/hooks/usePersistedBoolean";
import { useSearchForcedOpen } from "@/hooks/useSearchForcedOpen";
import { COLLECTIONS_SECTION_OPEN_KEY } from "./constants";

interface CollectionsSectionProps {
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

export function CollectionsSection({
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
}: CollectionsSectionProps) {
  // Controlled (rather than the Collapsible's own defaultOpen) so the
  // wrapper's flex-1 can be gated on it below — otherwise collapsing this
  // section would still leave its wrapper claiming all leftover sidebar
  // height for nothing, pushing Environments/the log panel down behind a
  // dead gap instead of the two sections sitting flush together.
  const [persistedOpen, setPersistedOpen] = usePersistedBoolean(COLLECTIONS_SECTION_OPEN_KEY, true);
  const [isOpen, setOpen] = useSearchForcedOpen(query, persistedOpen, setPersistedOpen);

  return (
    <div className={cn("flex min-h-0 flex-col", isOpen && "flex-1")}>
      <Collapsible open={isOpen} onOpenChange={setOpen} className="flex min-h-0 flex-1 flex-col">
        <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
          Collections
        </CollapsibleTrigger>
        <CollapsibleContent className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pl-3">
          <CollectionTree
            collections={collections}
            query={query}
            onRenameCollection={onRenameCollection}
            onDeleteCollection={onDeleteCollection}
            onRunCollection={onRunCollection}
            onExportCollection={onExportCollection}
            onOpenRequest={onOpenRequest}
            onAddFolder={onAddFolder}
            onAddRequest={onAddRequest}
            onRunNode={onRunNode}
            onRenameNode={onRenameNode}
            onDeleteNode={onDeleteNode}
            onMoveNode={onMoveNode}
            runningId={runningId}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
