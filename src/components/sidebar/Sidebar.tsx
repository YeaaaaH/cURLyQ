import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Environment, filterEnvironments } from "@/lib/environments";
import { type Collection, type CollectionNode, type RequestNode, filterCollections } from "@/lib/collections";
import type { ImportExportLogEntry } from "@/lib/importExportLog";
import { SidebarSearchAndAdd } from "./SidebarSearchAndAdd";
import { CollectionsSection } from "./CollectionsSection";
import { EnvironmentsSection } from "./EnvironmentsSection";
import { ImportExportLogPanel } from "./ImportExportLogPanel";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface CollectionsProps {
  collections: readonly Collection[];
  onAddCollection: () => string;
  onImportCollection: () => void;
  onExportCollection: (id: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onRunCollection: (id: string) => void;
  onOpenCollectionRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequestNode: (collectionId: string, parentFolderId: string | null) => string;
  onRunCollectionNode: (collectionId: string, node: CollectionNode) => void;
  onRenameCollectionNode: (collectionId: string, nodeId: string, name: string) => void;
  onDeleteCollectionNode: (collectionId: string, nodeId: string) => void;
  onMoveCollectionNode: (draggedId: string, targetId: string) => void;
  runningId: string | null;
}

interface EnvironmentsProps {
  environments: readonly Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string) => void;
  onEditEnvironment: (id: string) => void;
  onAddEnvironment: () => void;
  onImportEnvironment: () => void;
  onExportEnvironment: (id: string) => void;
  onDeleteEnvironment: (id: string) => void;
}

interface SidebarProps {
  sidebarOpen: boolean;
  onHandlePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onToggleSidebar: () => void;
  onCollapseSidebar: () => void;
  importExportLog: readonly ImportExportLogEntry[];
  collectionsProps: CollectionsProps;
  environmentsProps: EnvironmentsProps;
}

// Memoized: its trees can grow large. Callers keep props stable (see App.tsx).
export const Sidebar = memo(function Sidebar({
  sidebarOpen,
  onHandlePointerDown,
  onToggleSidebar,
  onCollapseSidebar,
  importExportLog,
  collectionsProps,
  environmentsProps,
}: SidebarProps) {
  const [query, setQuery] = useState("");

  const filteredCollections = useMemo(
    () => filterCollections(collectionsProps.collections, query),
    [collectionsProps.collections, query]
  );
  const filteredEnvironments = useMemo(
    () => filterEnvironments(environmentsProps.environments, query),
    [environmentsProps.environments, query]
  );

  function handleEdgeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onToggleSidebar();
  }

  return (
    <>
      <div
        // Stays mounted at width 0 so it can animate; `inert` keeps it out of tab order.
        inert={!sidebarOpen}
        className={cn(
          "fixed top-8 bottom-0 left-0 z-30 overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-150",
          sidebarOpen ? "w-[var(--app-sidebar-width)]" : "w-0"
        )}
      >
        <div className="flex h-full w-[var(--app-sidebar-width)] flex-col gap-1 p-3">
          <div className="flex shrink-0 items-center gap-2 pb-1">
            <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary/90 to-primary text-sm font-extrabold text-primary-foreground shadow-sm">
              Q
            </div>
            <span className="text-base font-extrabold tracking-tight">cURLyQ</span>
            <ThemeSwitcher />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onCollapseSidebar}
              aria-label="Collapse sidebar"
              className="size-7"
            >
              <PanelLeftClose className="size-3.5" />
            </Button>
          </div>

          <SidebarSearchAndAdd
            query={query}
            onQueryChange={setQuery}
            onAddCollection={collectionsProps.onAddCollection}
            onAddEnvironment={environmentsProps.onAddEnvironment}
            onImportEnvironment={environmentsProps.onImportEnvironment}
            onImportCollection={collectionsProps.onImportCollection}
          />

          <CollectionsSection
            collections={filteredCollections}
            query={query}
            onRenameCollection={collectionsProps.onRenameCollection}
            onDeleteCollection={collectionsProps.onDeleteCollection}
            onRunCollection={collectionsProps.onRunCollection}
            onExportCollection={collectionsProps.onExportCollection}
            onOpenRequest={collectionsProps.onOpenCollectionRequest}
            onAddFolder={collectionsProps.onAddFolder}
            onAddRequest={collectionsProps.onAddRequestNode}
            onRunNode={collectionsProps.onRunCollectionNode}
            onRenameNode={collectionsProps.onRenameCollectionNode}
            onDeleteNode={collectionsProps.onDeleteCollectionNode}
            onMoveNode={collectionsProps.onMoveCollectionNode}
            runningId={collectionsProps.runningId}
          />

          <EnvironmentsSection
            environments={filteredEnvironments}
            query={query}
            activeEnvironmentId={environmentsProps.activeEnvironmentId}
            onSelectEnvironment={environmentsProps.onSelectEnvironment}
            onEditEnvironment={environmentsProps.onEditEnvironment}
            onExportEnvironment={environmentsProps.onExportEnvironment}
            onDeleteEnvironment={environmentsProps.onDeleteEnvironment}
          />

          <div className="mt-auto">
            <ImportExportLogPanel log={importExportLog} />
          </div>
        </div>
      </div>

      <div
        onPointerDown={onHandlePointerDown}
        onKeyDown={handleEdgeKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className={cn(
          "fixed top-8 bottom-0 z-40 w-1 cursor-ew-resize touch-none outline-none hover:bg-foreground/20 focus-visible:ring-3 focus-visible:ring-ring-glow",
          sidebarOpen ? "left-[var(--app-sidebar-width)]" : "left-0"
        )}
      />
    </>
  );
});
