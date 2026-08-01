import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@/lib/http";
import { statusVariant } from "@/lib/requestTabs";
import type { RunResultTab } from "@/lib/tabs";
import { ResponseContainer } from "@/components/response-container/ResponseContainer";
import { ScriptLogsPanel } from "@/components/request-variables-tabs/scripts/ScriptLogsPanel";

interface RunResultsViewProps {
  tab: RunResultTab;
}

export function RunResultsView({ tab }: RunResultsViewProps) {
  const { label, result } = tab;
  const { steps, passed, failed } = result;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <h2 className="text-sm font-medium text-foreground">Run: {label}</h2>
        <Badge variant={failed === 0 ? "success" : "destructive"}>
          {passed}/{steps.length} passed
        </Badge>
      </div>

      <Card className="scrollbar-thin min-h-0 flex-1 overflow-y-auto gap-0 py-0 ring-0">
        {steps.map((step) => {
          const scriptsRan = step.scriptRun.pre !== null || step.scriptRun.post !== null;
          return (
            <Collapsible key={step.requestId} className="border-b border-border last:border-b-0">
              <CollapsibleTrigger className="group flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted/50">
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                <span
                  className={cn(
                    "w-10 shrink-0 overflow-hidden text-center text-[10px] font-semibold tracking-tighter",
                    METHOD_COLORS[step.method]
                  )}
                >
                  {step.method}
                </span>
                <span className="min-w-0 shrink-0 basis-48 truncate">{step.requestName}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{step.url}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{step.durationMs}ms</span>
                {step.response ? (
                  <Badge variant={statusVariant(step.response.status)} className="shrink-0 font-mono">
                    {step.response.status}
                  </Badge>
                ) : (
                  // Just a compact flag here — the full error text is
                  // already shown below via ResponseError once expanded, no
                  // need to repeat it (and blow up the row width) here too.
                  <Badge variant="destructive" className="shrink-0">
                    Error
                  </Badge>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-3 overflow-hidden border-t border-border bg-muted/20 p-3 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <div className="flex h-80 min-h-0 flex-col">
                  <ResponseContainer error={step.error} response={step.response} />
                </div>

                {/* Collapsed by default when no pre/post-request script ran
                    for this request (the common case) — auto-opened when one
                    did, since that's worth seeing right away. */}
                <Collapsible defaultOpen={scriptsRan} className="flex shrink-0 flex-col gap-2">
                  <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                    Scripts
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex h-64 min-h-0 flex-col overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                    <ScriptLogsPanel lastScriptRun={step.scriptRun} />
                  </CollapsibleContent>
                </Collapsible>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </Card>
    </div>
  );
}
