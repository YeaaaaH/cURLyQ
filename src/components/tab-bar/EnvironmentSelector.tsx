import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Globe, Pencil } from "lucide-react";
import type { Environment } from "@/lib/environments";

interface EnvironmentSelectorProps {
  environments: readonly Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string | null) => void;
  onEditEnvironment: (id: string) => void;
}

export function EnvironmentSelector({
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onEditEnvironment,
}: EnvironmentSelectorProps) {
  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="max-w-[9rem] shrink-0 gap-1.5 text-muted-foreground">
          <Globe className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{activeEnvironment?.name ?? "No environment"}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        // <main> has a fixed p-6 (1.5rem) padding and this trigger is the
        // last element in its top row, so the trigger's right edge is
        // always exactly `100vw - 1.5rem` — no DOM measurement needed to
        // keep the menu's left edge from crossing the window's midpoint.
        className="scrollbar-thin w-64 max-w-[calc(50vw-1.5rem)] max-h-[min(50vh,var(--radix-dropdown-menu-content-available-height))]"
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
  );
}
