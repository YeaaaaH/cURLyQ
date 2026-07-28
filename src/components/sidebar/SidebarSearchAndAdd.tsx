import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderPlus, Globe, Plus, Search, Upload } from "lucide-react";

interface SidebarSearchAndAddProps {
  onAddCollection: () => void;
  onAddEnvironment: () => void;
  onImportEnvironment: () => void;
  onImportCollection: () => void;
}

export function SidebarSearchAndAdd({
  onAddCollection,
  onAddEnvironment,
  onImportEnvironment,
  onImportCollection,
}: SidebarSearchAndAddProps) {
  return (
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
          <DropdownMenuItem onClick={onImportCollection}>
            <Upload className="size-3.5" />
            Import collection...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
