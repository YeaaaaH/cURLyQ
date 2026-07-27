import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyValuePair } from "@/lib/keyValue";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";
import { VariableAwareInput } from "@/components/VariableAwareInput";

// Bundled together (rather than 5 separate props) since they only ever
// travel as a set — the Value column below is variable-aware only when
// this whole set is provided.
export interface VariableAwareProps {
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}

export const KeyValueEditor = memo(function KeyValueEditor({
  rows,
  onUpdate,
  onRemove,
  lockedRows = [],
  variableAware,
}: {
  rows: KeyValuePair[];
  onUpdate: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemove: (index: number) => void;
  // Read-only rows shown above the editable ones — e.g. default headers
  // that are sent automatically. Not part of `rows`/persisted data; purely
  // informational, so there's no enabled/remove affordance for them.
  lockedRows?: { key: string; value: string }[];
  // Omitted by the Environment editor, which uses this same component to
  // edit a variable's own raw value — {{var}} coloring/hover against the
  // variable currently being defined isn't in scope there. When omitted,
  // the Value column falls back to a plain Input.
  variableAware?: VariableAwareProps;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="w-4" />
        <span className="flex-1">Key</span>
        <span className="flex-1">Value</span>
        <span className="w-8" />
      </div>
      {lockedRows.map((row) => (
        <div
          key={`locked-${row.key}`}
          className="flex items-center gap-2"
          title="Sent automatically unless you add your own"
        >
          <Checkbox checked disabled className="opacity-70" aria-label={`${row.key} is sent automatically`} />
          <Input className="font-mono" value={row.key} disabled />
          <Input className="font-mono" value={row.value} disabled />
          <span className="size-8 shrink-0" />
        </div>
      ))}
      {rows.map((row, index) => {
        const isTrailingEmpty =
          index === rows.length - 1 && row.key.trim() === "" && row.value.trim() === "";
        return (
          <div key={row.id} className={cn("flex items-center gap-2", !row.enabled && "opacity-50")}>
            <Checkbox
              checked={row.enabled}
              onCheckedChange={(checked) => onUpdate(index, { enabled: checked === true })}
              aria-label={`Include ${row.key} in request`}
              className={isTrailingEmpty ? "invisible" : undefined}
            />
            <Input
              className="min-w-0 flex-1 font-mono"
              placeholder="key"
              value={row.key}
              onChange={(e) => onUpdate(index, { key: e.target.value })}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {variableAware ? (
              <VariableAwareInput
                className="font-mono"
                placeholder="value"
                value={row.value}
                onChange={(value) => onUpdate(index, { value })}
                environment={variableAware.environment}
                variableContext={variableAware.variableContext}
                onUpdateVariable={variableAware.onUpdateVariable}
                onOpenEnvironment={variableAware.onOpenEnvironment}
                onOpenVariablesPanel={variableAware.onOpenVariablesPanel}
              />
            ) : (
              <Input
                className="min-w-0 flex-1 font-mono"
                placeholder="value"
                value={row.value}
                onChange={(e) => onUpdate(index, { value: e.target.value })}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              aria-label="Remove row"
              className={isTrailingEmpty ? "invisible" : undefined}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
});
