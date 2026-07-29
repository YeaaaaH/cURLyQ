import { memo } from "react";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/environments";
import type { Collection, RequestNode } from "@/lib/collections";
import type { ImportExportLogEntry } from "@/lib/importExportLog";
import { SidebarSearchAndAdd } from "./SidebarSearchAndAdd";
import { CollectionsSection } from "./CollectionsSection";
import { EnvironmentsSection } from "./EnvironmentsSection";
import { ImportExportLogPanel } from "./ImportExportLogPanel";
import { useCollectionsSplit } from "./useCollectionsSplit";

interface SidebarProps {
  sidebarOpen: boolean;
  onHandlePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  environments: readonly Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string) => void;
  onEditEnvironment: (id: string) => void;
  onAddEnvironment: () => void;
  onImportEnvironment: () => void;
  onExportEnvironment: (id: string) => void;
  onDeleteEnvironment: (id: string) => void;
  importExportLog: readonly ImportExportLogEntry[];
  collections: readonly Collection[];
  onAddCollection: () => string;
  onImportCollection: () => void;
  onExportCollection: (id: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onOpenCollectionRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequestNode: (collectionId: string, parentFolderId: string | null) => string;
  onRenameCollectionNode: (collectionId: string, nodeId: string, name: string) => void;
  onDeleteCollectionNode: (collectionId: string, nodeId: string) => void;
  onMoveCollectionNode: (draggedId: string, targetId: string) => void;
}

// Memoized since its collections/environments trees can grow large — every
// callback prop it receives is itself wrapped in useCallback (see
// useEnvironments.ts/useCollections.ts/useEdgeDragPanel.ts) so this actually
// skips re-rendering while, say, typing in the active request's URL/body.
export const Sidebar = memo(function Sidebar({
  sidebarOpen,
  onHandlePointerDown,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onEditEnvironment,
  onAddEnvironment,
  onImportEnvironment,
  onExportEnvironment,
  onDeleteEnvironment,
  importExportLog,
  collections,
  onAddCollection,
  onImportCollection,
  onExportCollection,
  onRenameCollection,
  onDeleteCollection,
  onOpenCollectionRequest,
  onAddFolder,
  onAddRequestNode,
  onRenameCollectionNode,
  onDeleteCollectionNode,
  onMoveCollectionNode,
}: SidebarProps) {
  const collectionsSplit = useCollectionsSplit();

  return (
    <>
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 overflow-hidden border-r bg-muted transition-[width] duration-150",
          sidebarOpen ? "w-[var(--app-sidebar-width)]" : "w-0"
        )}
      >
        <div className="flex h-full w-[var(--app-sidebar-width)] flex-col gap-1 p-3">
          <SidebarSearchAndAdd
            onAddCollection={onAddCollection}
            onAddEnvironment={onAddEnvironment}
            onImportEnvironment={onImportEnvironment}
            onImportCollection={onImportCollection}
          />

          <CollectionsSection
            wrapperRef={collectionsSplit.wrapperRef}
            height={collectionsSplit.height}
            collections={collections}
            onRenameCollection={onRenameCollection}
            onDeleteCollection={onDeleteCollection}
            onExportCollection={onExportCollection}
            onOpenRequest={onOpenCollectionRequest}
            onAddFolder={onAddFolder}
            onAddRequest={onAddRequestNode}
            onRenameNode={onRenameCollectionNode}
            onDeleteNode={onDeleteCollectionNode}
            onMoveNode={onMoveCollectionNode}
          />

          <div
            onPointerDown={collectionsSplit.onSplitPointerDown}
            role="separator"
            aria-label="Drag to resize Collections/Environments"
            className="group/split-handle shrink-0 cursor-ns-resize touch-none py-1"
          >
            <div
              className={cn(
                "border-t-2 transition-[height]",
                collectionsSplit.isDragging
                  ? "h-2 border-foreground/40"
                  : "h-0.5 border-transparent group-hover/split-handle:border-foreground/20"
              )}
            />
          </div>

          <EnvironmentsSection
            environments={environments}
            activeEnvironmentId={activeEnvironmentId}
            onSelectEnvironment={onSelectEnvironment}
            onEditEnvironment={onEditEnvironment}
            onExportEnvironment={onExportEnvironment}
            onDeleteEnvironment={onDeleteEnvironment}
          />

          <ImportExportLogPanel log={importExportLog} />
        </div>
      </div>

      <div
        onPointerDown={onHandlePointerDown}
        role="separator"
        aria-label="Drag to open or close the sidebar"
        className={cn(
          "fixed inset-y-0 z-40 w-1 cursor-ew-resize touch-none hover:bg-foreground/20",
          sidebarOpen ? "left-[var(--app-sidebar-width)]" : "left-0"
        )}
      />
    </>
  );
});
