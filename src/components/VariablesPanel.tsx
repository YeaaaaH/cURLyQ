import { useState } from "react";
import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type VariableLookup, resolveVariable, tokenizeVariables } from "@/lib/variables";

const TABS = [
  { id: "variables", label: "Variables" },
  { id: "curl", label: "cURL" },
] as const;
type PanelTab = (typeof TABS)[number]["id"];

export function VariablesPanel({
  open,
  onClose,
  onHandlePointerDown,
  variableNames,
  variableContext,
  onUpdateVariable,
  curlCommand,
}: {
  open: boolean;
  onClose: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  variableNames: string[];
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  curlCommand: string;
}) {
  const [activeTab, setActiveTab] = useState<PanelTab>("variables");

  function handleCopyCurl() {
    navigator.clipboard.writeText(curlCommand);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-30 overflow-hidden border-l bg-muted transition-[width] duration-150",
          open ? "w-[max(16vw,280px)]" : "w-0"
        )}
      >
        <div className="flex h-full w-[16vw] min-w-[280px] flex-col gap-3 p-3">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Variables in request</h2>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex w-fit shrink-0 gap-1 rounded-lg bg-secondary p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border border-input bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "variables" ? (
            <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
              {variableNames.length === 0 ? (
                <p className="text-sm text-muted-foreground">No variables used in this request.</p>
              ) : (
                variableNames.map((name) => {
                  const resolution = resolveVariable(name, variableContext);
                  // Same rule as the hover popup: only editable when the raw
                  // value is a direct literal, so editing here can't silently
                  // flatten a {{nested}} reference into a literal.
                  const rawValue = variableContext.lookup(name);
                  const isDirectValue = rawValue !== undefined && tokenizeVariables(rawValue).length === 0;
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span
                        className="w-24 shrink-0 truncate font-mono text-sm text-muted-foreground"
                        title={name}
                      >
                        {name}
                      </span>
                      {resolution.kind === "unresolved" ? (
                        <span className="text-sm text-destructive">unresolved</span>
                      ) : resolution.kind === "circular" ? (
                        <span className="text-sm text-destructive">
                          {resolution.chain.join(" → ")} — circular reference
                        </span>
                      ) : isDirectValue ? (
                        <Input
                          className="h-8 min-w-0 flex-1 font-mono text-sm"
                          value={resolution.value}
                          onChange={(e) => onUpdateVariable(name, e.target.value)}
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      ) : (
                        <span className="min-w-0 flex-1 truncate font-mono text-sm" title={resolution.value}>
                          {resolution.value}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <div className="flex shrink-0 items-center justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopyCurl}
                  aria-label="Copy cURL command"
                  title="Copy"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <pre className="scrollbar-thin min-h-0 flex-1 overflow-auto rounded-md border border-input bg-background p-2 font-mono text-xs whitespace-pre-wrap text-foreground">
                {curlCommand}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div
        onPointerDown={onHandlePointerDown}
        role="separator"
        aria-label="Drag to open the variables panel"
        className={cn(
          "fixed inset-y-0 z-40 w-1 cursor-ew-resize touch-none hover:bg-foreground/20",
          open ? "right-[max(16vw,280px)]" : "right-0"
        )}
      />
    </>
  );
}
