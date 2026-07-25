import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FolderPlus,
  Globe,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/environments";
import type { Collection, RequestNode } from "@/lib/collections";
import { type ImportExportLogEntry, formatRelativeTime } from "@/lib/importExportLog";
import { CollectionTree } from "@/components/CollectionTree";

export function Sidebar({
  sidebarWidth,
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
  onImportEnvironment: () => void;
  onExportEnvironment: (id: string) => void;
  onDeleteEnvironment: (id: string) => void;
  importExportLog: ImportExportLogEntry[];
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
  const [detailEntry, setDetailEntry] = useState<ImportExportLogEntry | null>(null);

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
                <DropdownMenuItem onClick={onImportEnvironment}>
                  <Upload className="size-3.5" />
                  Import environment...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Collapsible defaultOpen className="flex min-h-0 max-h-[50%] shrink flex-col">
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
                      onClick={() => onExportEnvironment(env.id)}
                      aria-label={`Export ${env.name}`}
                      className="shrink-0 text-muted-foreground opacity-0 group-hover/sidebar-env:opacity-100"
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEditEnvironment(env.id)}
                      aria-label={`Edit ${env.name}`}
                      className="shrink-0 text-muted-foreground opacity-0 group-hover/sidebar-env:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDeleteEnvironment(env.id)}
                      aria-label={`Delete ${env.name}`}
                      className="mr-0.5 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover/sidebar-env:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full shrink-0 justify-start gap-2 px-2 text-muted-foreground hover:text-foreground"
              >
                <History className="size-3.5" />
                Import/Export Log
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-80 p-2">
              {importExportLog.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  No imports or exports yet.
                </p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {importExportLog.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setDetailEntry(entry)}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                    >
                      {entry.status === "success" ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {entry.status === "error"
                            ? `${entry.direction === "import" ? "Import" : "Export"} failed: ${entry.label}`
                            : `${entry.direction === "import" ? "Imported" : "Exported"} "${entry.label}"${
                                entry.variableCount !== undefined
                                  ? ` (${entry.variableCount} variables)`
                                  : ""
                              }`}
                        </p>
                        {entry.message && (
                          <p className="truncate text-xs text-destructive">{entry.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(entry.timestamp)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Dialog open={detailEntry !== null} onOpenChange={(open) => !open && setDetailEntry(null)}>
            <DialogContent>
              {detailEntry && (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      {detailEntry.direction === "import" ? "Import" : "Export"}{" "}
                      {detailEntry.status === "success" ? "succeeded" : "failed"}
                    </DialogTitle>
                    <DialogDescription>
                      {new Date(detailEntry.timestamp).toLocaleString()}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        {detailEntry.status === "error" ? "File: " : "Environment: "}
                      </span>
                      {detailEntry.label}
                    </div>
                    {detailEntry.variableCount !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Variables: </span>
                        {detailEntry.variableCount}
                      </div>
                    )}
                    {detailEntry.message && (
                      <div>
                        <span className="text-muted-foreground">Error:</span>
                        <p className="mt-1 rounded-md bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap select-text">
                          {detailEntry.message}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
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
