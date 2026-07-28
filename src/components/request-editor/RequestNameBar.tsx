import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Copy, Save } from "lucide-react";

interface RequestNameBarProps {
  name: string;
  onNameChange: (name: string) => void;
  onCommitName: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export function RequestNameBar({ name, onNameChange, onCommitName, onSave, onSaveAs }: RequestNameBarProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onBlur={onCommitName}
        placeholder="Untitled request"
        aria-label="Request name"
        className="w-full rounded-md bg-transparent px-2 py-1 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <ButtonGroup className="shrink-0">
        <Button type="button" variant="outline" onClick={onSave} title="Save (Ctrl+S)">
          <Save />
          Save
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Save options">
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSaveAs}>
              <Copy />
              Save as...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </div>
  );
}
