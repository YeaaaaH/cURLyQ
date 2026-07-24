import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { HTTP_METHODS } from "@/lib/http";
import { SUB_TABS, type RequestTab } from "@/lib/requestTabs";

export function RequestEditor({
  activeRequest,
  onUpdate,
  onUrlChange,
  onSend,
  canSend,
  urlError,
  unresolvedVariables,
}: {
  activeRequest: RequestTab;
  onUpdate: (patch: Partial<RequestTab>) => void;
  onUrlChange: (rawUrl: string) => void;
  onSend: (e: React.FormEvent) => void;
  canSend: boolean;
  urlError: string | null;
  unresolvedVariables: string[];
}) {
  return (
    <>
      <input
        type="text"
        value={activeRequest.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        onBlur={() => {
          if (activeRequest.name.trim() === "") {
            onUpdate({ name: "Untitled request" });
          }
        }}
        placeholder="Untitled request"
        aria-label="Request name"
        className="-ml-2 w-full rounded-md bg-transparent px-2 py-1 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      <form className="flex flex-col gap-1.5" onSubmit={onSend}>
        <div className="flex gap-2">
          <Select
            value={activeRequest.method}
            onValueChange={(method) => onUpdate({ method })}
          >
            <SelectTrigger className="w-28 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="font-mono aria-invalid:border-destructive"
            type="text"
            value={activeRequest.url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://example.com"
            aria-invalid={urlError !== null}
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
