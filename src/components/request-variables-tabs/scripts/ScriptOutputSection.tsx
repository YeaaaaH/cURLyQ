import { Badge } from "@/components/ui/badge";
import type { ScriptRunResult } from "@/lib/scripting/types";

interface ScriptOutputSectionProps {
  label: string;
  result: ScriptRunResult | null;
}

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

// A no-op run shows nothing; any real output gets a "Success" badge, since a page of
// console.log(undefined) lines alone looks like a failure.
export function ScriptOutputSection({ label, result }: ScriptOutputSectionProps) {
  const changes = result ? describeChanges(result) : [];
  const hasOutput = result !== null && (result.logs.length > 0 || result.error !== null || changes.length > 0);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 rounded-md border border-input p-2">
      <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
        {label}
        {result?.error && <Badge variant="destructive">Failed</Badge>}
        {result && !result.error && hasOutput && <Badge variant="success">Success</Badge>}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto font-mono text-xs">
        {result === null ? (
          <p className="text-muted-foreground">Not run yet.</p>
        ) : !hasOutput ? (
          <p className="text-muted-foreground">No output.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {changes.map((change, i) => (
              <p key={`change-${i}`} className="text-success">
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
