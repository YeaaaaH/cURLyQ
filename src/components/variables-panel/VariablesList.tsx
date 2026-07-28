import { Input } from "@/components/ui/input";
import { type VariableLookup, resolveVariable, tokenizeVariables } from "@/lib/variables";

interface VariablesListProps {
  variableNames: readonly string[];
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
}

export function VariablesList({ variableNames, variableContext, onUpdateVariable }: VariablesListProps) {
  return (
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
              <span className="w-24 shrink-0 truncate font-mono text-sm text-muted-foreground" title={name}>
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
  );
}
