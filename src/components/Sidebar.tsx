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
import { ChevronDown, FolderPlus, Globe, Pencil, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/environments";
import type { Collection, RequestNode } from "@/lib/collections";
import { CollectionTree } from "@/components/CollectionTree";

export function Sidebar({
  sidebarWidth,
  onHandlePointerDown,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onEditEnvironment,
  onAddEnvironment,
  collections,
  onAddCollection,
  onRenameCollection,
  onDeleteCollection,
  onOpenCollectionRequest,
  onAddFolder,
  onAddRequestNode,
  onRenameCollectionNode,
  onDeleteCollectionNode,
  onMoveCollectionNode,
}: {
  sidebarWidth: number;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string) => void;
  onEditEnvironment: (id: string) => void;
  onAddEnvironment: () => void;
  collections: Collection[];
  onAddCollection: () => string;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onOpenCollectionRequest: (collectionId: string, node: RequestNode) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequestNode: (collectionId: string, parentFolderId: string | null) => string;
  onRenameCollectionNode: (collectionId: string, nodeId: string, name: string) => void;
  onDeleteCollectionNode: (collectionId: string, nodeId: string) => void;
  onMoveCollectionNode: (draggedId: string, targetId: string) => void;
}) {
  return (
    <>
      <div
        className="fixed inset-y-0 left-0 z-30 overflow-hidden border-r bg-muted transition-[width] duration-150"
        style={{ width: sidebarWidth }}
      >
        <div className="flex h-full w-[16vw] min-w-[180px] flex-col gap-1 p-3">
          <div className="flex shrink-0 items-center gap-1.5 pb-1">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              {/* Not wired up yet — filtering collections/environments as you
                  type is a follow-up, this is just the search bar's shell. */}
              <Input placeholder="Search..." className="h-8 pl-7" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="New..." className="h-8 w-8 shrink-0">
                  <Plus className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onAddCollection}>
                  <FolderPlus className="size-3.5" />
                  Collection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onAddEnvironment}>
                  <Globe className="size-3.5" />
                  Environment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
                onOpenRequest={onOpenCollectionRequest}
                onAddFolder={onAddFolder}
                onAddRequest={onAddRequestNode}
                onRenameNode={onRenameCollectionNode}
                onDeleteNode={onDeleteCollectionNode}
                onMoveNode={onMoveCollectionNode}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen className="flex min-h-0 flex-1 flex-col">
            <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
              Environments
            </CollapsibleTrigger>
            <CollapsibleContent className="flex min-h-0 flex-1 flex-col gap-1 pl-3">
              <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className={cn(
                      "group/sidebar-env flex shrink-0 items-center rounded-md",
                      env.id === activeEnvironmentId && "bg-secondary"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectEnvironment(env.id)}
                      className={cn(
                        "min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm",
                        env.id === activeEnvironmentId
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {env.name}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEditEnvironment(env.id)}
                      aria-label={`Edit ${env.name}`}
                      className="mr-0.5 shrink-0 text-muted-foreground opacity-0 group-hover/sidebar-env:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div
        onPointerDown={onHandlePointerDown}
        role="separator"
        aria-label="Drag to open the environments sidebar"
        className="fixed inset-y-0 z-40 w-1 cursor-ew-resize touch-none hover:bg-foreground/20"
        style={{ left: sidebarWidth }}
      />
    </>
  );
}
