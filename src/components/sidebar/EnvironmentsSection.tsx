import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Download, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/environments";

interface EnvironmentRowProps {
  environment: Environment;
  active: boolean;
  onSelect: () => void;
  onExport: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function EnvironmentRow({ environment, active, onSelect, onExport, onEdit, onDelete }: EnvironmentRowProps) {
  return (
    <div className={cn("group/sidebar-env flex shrink-0 items-center rounded-md", active && "bg-secondary")}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm",
          active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {environment.name}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onExport}
        aria-label={`Export ${environment.name}`}
        className="shrink-0 text-muted-foreground opacity-0 group-hover/sidebar-env:opacity-100"
      >
        <Download className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onEdit}
        aria-label={`Edit ${environment.name}`}
        className="shrink-0 text-muted-foreground opacity-0 group-hover/sidebar-env:opacity-100"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        aria-label={`Delete ${environment.name}`}
        className="mr-0.5 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover/sidebar-env:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

interface EnvironmentsSectionProps {
  environments: readonly Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string) => void;
  onEditEnvironment: (id: string) => void;
  onExportEnvironment: (id: string) => void;
  onDeleteEnvironment: (id: string) => void;
}

export function EnvironmentsSection({
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onEditEnvironment,
  onExportEnvironment,
  onDeleteEnvironment,
}: EnvironmentsSectionProps) {
  return (
    <Collapsible defaultOpen className="flex min-h-0 flex-1 flex-col">
      <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
        Environments
      </CollapsibleTrigger>
      <CollapsibleContent className="flex min-h-0 flex-1 flex-col gap-1 pl-3">
        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {environments.map((environment) => (
            <EnvironmentRow
              key={environment.id}
              environment={environment}
              active={environment.id === activeEnvironmentId}
              onSelect={() => onSelectEnvironment(environment.id)}
              onExport={() => onExportEnvironment(environment.id)}
              onEdit={() => onEditEnvironment(environment.id)}
              onDelete={() => onDeleteEnvironment(environment.id)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
