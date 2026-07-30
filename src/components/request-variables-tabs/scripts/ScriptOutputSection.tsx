import { Badge } from "@/components/ui/badge";
import type { ScriptRunResult } from "@/lib/scripting/types";

interface ScriptOutputSectionProps {
  label: string;
  result: ScriptRunResult | null;
}

// A script that set an environment variable or overrode a header/body *did*
// do something worth confirming, even without a single console.log call —
// it just needs a different kind of feedback than a log line: what actually
// changed, not just "it ran."
function describeChanges(result: ScriptRunResult): string[] {
  const changes: string[] = [];
  const envKeys = Object.keys(result.environmentPatch);
  if (envKeys.length > 0) {
    changes.push(`Set environment variable${envKeys.length > 1 ? "s" : ""}: ${envKeys.join(", ")}`);
  }
  const headerKeys = Object.keys(result.requestPatch?.headers ?? {});
  if (headerKeys.length > 0) {
    changes.push(`Set header${headerKeys.length > 1 ? "s" : ""}: ${headerKeys.join(", ")}`);
  }
  if (result.requestPatch?.body !== undefined) {
    changes.push("Overrode the request body");
  }
  return changes;
}

// One half's last run, always fully visible (no click-to-expand) — lives
// inside the dedicated Logs tab (see ScriptLogsPanel.tsx), which has no
// script editor sharing its space, so there's nothing left to protect by
// collapsing this.
//
// A script that ran clean, logged nothing, and changed nothing didn't do
// anything worth flagging — no badge, no "ran fine" filler text for that
// case, since that'd just be noise repeated on every single send. But once
// there IS output to look at (logs and/or changes), the absence of a red
// "Failed" badge isn't a strong enough signal on its own that it actually
// succeeded — several `console.log(undefined)` lines can look alarming even
// though nothing threw, so a "Success" badge accompanies real output too.
export function ScriptOutputSection({ label, result }: ScriptOutputSectionProps) {
  const changes = result ? describeChanges(result) : [];
  const hasOutput = result !== null && (result.logs.length > 0 || result.error !== null || changes.length > 0);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 rounded-md border border-input p-2">
      <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
        {label}
        {result?.error && <Badge variant="destructive">Failed</Badge>}
        {result && !result.error && hasOutput && (
          <Badge
            variant="outline"
            className="border-transparent bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20"
          >
            Success
          </Badge>
        )}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto font-mono text-xs">
        {result === null ? (
          <p className="text-muted-foreground">Not run yet.</p>
        ) : !hasOutput ? (
          <p className="text-muted-foreground">No output.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {changes.map((change, i) => (
              <p key={`change-${i}`} className="text-emerald-600">
                {change}
              </p>
            ))}
            {result.logs.map((line, i) => (
              <p key={i} className="text-muted-foreground">
                {line}
              </p>
            ))}
            {result.error && <p className="text-destructive">{result.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
