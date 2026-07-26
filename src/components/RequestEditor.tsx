import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Copy, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { HTTP_METHODS, METHOD_COLORS } from "@/lib/http";
import type { Environment } from "@/lib/environments";
import { SUB_TABS, type RequestTab } from "@/lib/requestTabs";
import { VariableAwareInput } from "@/components/VariableAwareInput";

export function RequestEditor({
  activeRequest,
  onUpdate,
  onCommitName,
  onUpdateMethod,
  onUrlChange,
  onSend,
  canSend,
  urlError,
  unresolvedVariables,
  onSave,
  onSaveAs,
  activeEnvironment,
  onUpdateEnvironmentVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
}: {
  activeRequest: RequestTab;
  onUpdate: (patch: Partial<RequestTab>) => void;
  onCommitName: () => void;
  onUpdateMethod: (method: string) => void;
  onUrlChange: (rawUrl: string) => void;
  onSend: (e: React.FormEvent) => void;
  canSend: boolean;
  urlError: string | null;
  unresolvedVariables: string[];
  onSave: () => void;
  onSaveAs: () => void;
  activeEnvironment: Environment | null;
  onUpdateEnvironmentVariable: (name: string, value: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={activeRequest.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
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

      <form className="flex flex-col gap-1.5" onSubmit={onSend}>
        <div className="flex gap-2">
          <Select
            value={activeRequest.method}
            onValueChange={onUpdateMethod}
          >
            <SelectTrigger className={cn("w-28 font-semibold", METHOD_COLORS[activeRequest.method])}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m} className={cn("font-semibold", METHOD_COLORS[m])}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <VariableAwareInput
            className="font-mono"
            value={activeRequest.url}
            onChange={onUrlChange}
            environment={activeEnvironment}
            onUpdateVariable={onUpdateEnvironmentVariable}
            onOpenEnvironment={onOpenEnvironment}
            onOpenVariablesPanel={onOpenVariablesPanel}
            placeholder="https://example.com"
            ariaInvalid={urlError !== null}
          />
          <Button type="submit" className="w-24" disabled={activeRequest.isSending || !canSend}>
            {activeRequest.isSending ? "Sending…" : "Send"}
          </Button>
        </div>
        {urlError && <p className="text-sm text-destructive">{urlError}</p>}
        {unresolvedVariables.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Unresolved variable{unresolvedVariables.length > 1 ? "s" : ""}:{" "}
            {unresolvedVariables.map((name) => `{{${name}}}`).join(", ")}
          </p>
        )}
      </form>

      <div className="flex w-fit shrink-0 gap-1 rounded-lg bg-secondary p-1">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onUpdate({ activeSubTab: tab.id })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeRequest.activeSubTab === tab.id
                ? "border border-input bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
}
