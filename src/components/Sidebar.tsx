import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/environments";

export function Sidebar({
  sidebarWidth,
  onHandlePointerDown,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onEditEnvironment,
  onAddEnvironment,
}: {
  sidebarWidth: number;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  environments: Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string) => void;
  onEditEnvironment: (id: string) => void;
  onAddEnvironment: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-y-0 left-0 z-30 overflow-hidden border-r bg-muted transition-[width] duration-150"
        style={{ width: sidebarWidth }}
      >
        <div className="flex h-full w-[16vw] min-w-[180px] flex-col gap-1 p-3">
          <Collapsible className="flex shrink-0 flex-col">
            <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
              Collections
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-3">
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No collections yet.</p>
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAddEnvironment}
                className="shrink-0 justify-start gap-1.5 text-muted-foreground"
              >
                <Plus className="size-3.5" />
                New environment
              </Button>
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
