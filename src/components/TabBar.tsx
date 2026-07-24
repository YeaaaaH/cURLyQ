import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Globe, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyValuePair } from "@/lib/keyValue";
import type { Environment } from "@/lib/environments";
import { METHOD_COLORS } from "@/lib/http";
import type { RequestTab } from "@/lib/requestTabs";
import { EnvironmentEditor } from "@/components/EnvironmentEditor";

export function TabBar({
  requests,
  activeId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  onWheel,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onEditEnvironment,
  environmentEditorOpen,
  onEnvironmentEditorOpenChange,
  editingEnvironmentId,
  onSelectEditingEnvironment,
  onAddEnvironment,
  onRenameEnvironment,
  onDeleteEnvironment,
  onUpdateEnvironmentVariable,
  onRemoveEnvironmentVariable,
}: {
  requests: RequestTab[];
  activeId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string | null) => void;
  onEditEnvironment: (id: string) => void;
  environmentEditorOpen: boolean;
  onEnvironmentEditorOpenChange: (open: boolean) => void;
  editingEnvironmentId: string | null;
  onSelectEditingEnvironment: (id: string) => void;
  onAddEnvironment: () => void;
  onRenameEnvironment: (id: string, name: string) => void;
  onDeleteEnvironment: (id: string) => void;
  onUpdateEnvironmentVariable: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemoveEnvironmentVariable: (index: number) => void;
}) {
  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) ?? null;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div
          className="scrollbar-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
          onWheel={onWheel}
        >
          {requests.map((tab) => (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectTab(tab.id);
              }}
              className={cn(
                "flex shrink-0 cursor-default items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                tab.id === activeId
                  ? "border border-input bg-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("text-xs font-semibold", METHOD_COLORS[tab.method])}>
                {tab.method}
              </span>
              <span className={tab.id === activeId ? "text-foreground" : undefined}>
                {tab.name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                aria-label={`Close ${tab.name}`}
                className="rounded p-0.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onAddTab}
          aria-label="New request tab"
          className="shrink-0"
        >
          <Plus />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-w-[9rem] shrink-0 gap-1.5 text-muted-foreground"
            >
              <Globe className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">{activeEnvironment?.name ?? "No environment"}</span>
              <ChevronDown className="size-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            // <main> has a fixed p-8 (2rem) padding and this trigger is the
            // last element in its top row, so the trigger's right edge is
            // always exactly `100vw - 2rem` — no DOM measurement needed to
            // keep the menu's left edge from crossing the window's midpoint.
            className="scrollbar-thin w-64 max-w-[calc(50vw-2rem)] max-h-[min(50vh,var(--radix-dropdown-menu-content-available-height))]"
          >
            <DropdownMenuRadioGroup
              value={activeEnvironmentId ?? ""}
              onValueChange={(value) => onSelectEnvironment(value === "" ? null : value)}
            >
              <DropdownMenuRadioItem value="">No environment</DropdownMenuRadioItem>
              {environments.map((env) => (
                <DropdownMenuRadioItem key={env.id} value={env.id} className="group gap-2">
                  <span className="min-w-0 flex-1 truncate">{env.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditEnvironment(env.id);
                    }}
                    aria-label={`Edit ${env.name}`}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/70 opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 group-data-[highlighted]:opacity-100"
                  >
                    <Pencil className="size-3" />
                  </button>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={environmentEditorOpen} onOpenChange={onEnvironmentEditorOpenChange}>
        <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw]">
          <DialogHeader>
            <DialogTitle>Environments</DialogTitle>
          </DialogHeader>
          <EnvironmentEditor
            environments={environments}
            editingId={editingEnvironmentId}
            onSelectEditing={onSelectEditingEnvironment}
            onAdd={onAddEnvironment}
            onRename={onRenameEnvironment}
            onDelete={onDeleteEnvironment}
            onUpdateVariable={onUpdateEnvironmentVariable}
            onRemoveVariable={onRemoveEnvironmentVariable}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
