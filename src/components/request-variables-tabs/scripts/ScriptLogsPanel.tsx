import type { LastScriptRun } from "@/lib/requestTabs";
import { ScriptOutputSection } from "./ScriptOutputSection";

interface ScriptLogsPanelProps {
  lastScriptRun: LastScriptRun;
}

export function ScriptLogsPanel({ lastScriptRun }: ScriptLogsPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-row gap-2">
      <ScriptOutputSection label="Pre-request" result={lastScriptRun.pre} />
      <ScriptOutputSection label="Post-response" result={lastScriptRun.post} />
    </div>
  );
}
