import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderPlus, Globe, Plus, Search, Upload } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface SidebarSearchAndAddProps {
  query: string;
  onQueryChange: (query: string) => void;
  onAddCollection: () => void;
  onAddEnvironment: () => void;
  onImportEnvironment: () => void;
  onImportCollection: () => void;
}

export function SidebarSearchAndAdd({
  query,
  onQueryChange,
  onAddCollection,
  onAddEnvironment,
  onImportEnvironment,
  onImportCollection,
}: SidebarSearchAndAddProps) {
  // Terminal swaps the magnifying glass for a "$" prompt glyph and the
  // placeholder for "grep" — can't be done as a token since it's a change of
  // icon/text, not just color, so it's this component's one deliberate
  // exception to "never branch on theme".
  const { theme } = useTheme();
  const isTerminal = theme === "terminal";

  return (
    <div className="flex shrink-0 items-center gap-1.5 pb-1">
      <div className="relative min-w-0 flex-1">
        {isTerminal ? (
          <span
            aria-hidden
            className="absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-xs text-muted-foreground"
          >
            $
          </span>
        ) : (
          <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={isTerminal ? "grep" : "Search..."}
          className="h-8 pl-7"
        />
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
          <DropdownMenuItem onClick={onImportCollection}>
            <Upload className="size-3.5" />
            Import collection...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
