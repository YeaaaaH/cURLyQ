import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariableLookup } from "@/lib/variables";
import { VariablesList } from "./VariablesList";
import { CurlPreview } from "./CurlPreview";

const TABS = [
  { id: "variables", label: "Variables" },
  { id: "curl", label: "cURL" },
] as const;
type PanelTab = (typeof TABS)[number]["id"];

interface VariablesPanelProps {
  open: boolean;
  onClose: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  variableNames: readonly string[];
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  curlCommand: string;
}

export function VariablesPanel({
  open,
  onClose,
  onHandlePointerDown,
  variableNames,
  variableContext,
  onUpdateVariable,
  curlCommand,
}: VariablesPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("variables");

  return (
    <>
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-30 overflow-hidden border-l border-sidebar-border bg-sidebar transition-[width] duration-150",
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
                    ? "border border-input bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "variables" ? (
            <VariablesList
              variableNames={variableNames}
              variableContext={variableContext}
              onUpdateVariable={onUpdateVariable}
            />
          ) : (
            <CurlPreview curlCommand={curlCommand} />
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
