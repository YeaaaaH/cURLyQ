import type { LastScriptRun } from "@/lib/requestTabs";
import { ScriptOutputSection } from "./ScriptOutputSection";

interface ScriptLogsPanelProps {
  lastScriptRun: LastScriptRun;
}

// The Scripts tab's "Logs" view — both halves' last run at once, side by
// side (not stacked) so each keeps the full height of the tab instead of
// splitting it into two cramped horizontal strips.
export function ScriptLogsPanel({ lastScriptRun }: ScriptLogsPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-row gap-2">
      <ScriptOutputSection label="Pre-request" result={lastScriptRun.pre} />
      <ScriptOutputSection label="Post-response" result={lastScriptRun.post} />
    </div>
  );
}
