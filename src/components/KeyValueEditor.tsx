import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyValuePair } from "@/lib/keyValue";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";
import { VariableAwareInput } from "@/components/VariableAwareInput";

export interface VariableAwareProps {
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onCreateVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}

// One grid template for the label row and every data row keeps columns aligned.
const GRID_COLUMNS = "grid grid-cols-[16px_1fr_1fr_32px] items-center gap-2";

function Row({
  keyValue,
  valueValue,
  locked,
  checked,
  autoFocusKey,
  onCheckedChange,
  onKeyChange,
  onValueChange,
  onRemove,
  variableAware,
}: {
  keyValue: string;
  valueValue: string;
  locked: boolean;
  checked: boolean;
  autoFocusKey?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onKeyChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  onRemove?: () => void;
  variableAware?: VariableAwareProps;
}) {
  return (
    <div
      className={cn(GRID_COLUMNS, !locked && !checked && "opacity-50")}
      title={locked ? "Sent automatically unless you add your own" : undefined}
    >
      <Checkbox
        checked={checked}
        disabled={locked}
        onCheckedChange={onCheckedChange ? (c) => onCheckedChange(c === true) : undefined}
        aria-label={locked ? `${keyValue} is sent automatically` : `Include ${keyValue} in request`}
        className={cn(locked && "opacity-70")}
      />
      <Input
        className="min-w-0 border-border bg-card font-mono"
        placeholder={locked ? undefined : "key"}
        value={keyValue}
        onChange={onKeyChange ? (e) => onKeyChange(e.target.value) : undefined}
        disabled={locked}
        autoFocus={autoFocusKey}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {variableAware && !locked ? (
        <VariableAwareInput
          className="border-border bg-card font-mono"
          placeholder="value"
          value={valueValue}
          onChange={(value) => onValueChange?.(value)}
          environment={variableAware.environment}
          variableContext={variableAware.variableContext}
          onUpdateVariable={variableAware.onUpdateVariable}
          onCreateVariable={variableAware.onCreateVariable}
          onOpenEnvironment={variableAware.onOpenEnvironment}
          onOpenVariablesPanel={variableAware.onOpenVariablesPanel}
        />
      ) : (
        <Input
          className="min-w-0 border-border bg-card font-mono"
          placeholder={locked ? undefined : "value"}
          value={valueValue}
          onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
          disabled={locked}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      )}
      {locked ? (
        <span className="size-8 shrink-0" />
      ) : (
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove row">
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}

export const KeyValueEditor = memo(function KeyValueEditor({
  rows,
  onUpdate,
  onRemove,
  lockedRows = [],
  variableAware,
  itemLabel = "row",
}: {
  rows: KeyValuePair[];
  onUpdate: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemove: (index: number) => void;
  // Informational only (e.g. default headers); not part of `rows`.
  lockedRows?: { key: string; value: string }[];
  // Omitted when editing a variable's own value; falls back to a plain Input.
  variableAware?: VariableAwareProps;
  itemLabel?: string;
}) {
  // The trailing blank row stays hidden behind "+ Add" until clicked; tracking its id
  // brings the button back once that row fills in.
  const [addingRowId, setAddingRowId] = useState<string | null>(null);
  const lastRow = rows[rows.length - 1];
  const lastRowIsBlank = lastRow.key.trim() === "" && lastRow.value.trim() === "";
  const showAddButton = lastRowIsBlank && addingRowId !== lastRow.id;
  const visibleRows = showAddButton ? rows.slice(0, -1) : rows;

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn(GRID_COLUMNS, "text-[11px] font-bold tracking-wide text-muted-foreground uppercase")}>
        <span />
        <span>Key</span>
        <span>Value</span>
        <span />
      </div>
      {lockedRows.map((row) => (
        <Row key={`locked-${row.key}`} locked checked keyValue={row.key} valueValue={row.value} />
      ))}
      {visibleRows.map((row, index) => (
        <Row
          key={row.id}
          locked={false}
          checked={row.enabled}
          autoFocusKey={row.id === addingRowId}
          keyValue={row.key}
          valueValue={row.value}
          onCheckedChange={(checked) => onUpdate(index, { enabled: checked })}
          onKeyChange={(value) => onUpdate(index, { key: value })}
          onValueChange={(value) => onUpdate(index, { value })}
          onRemove={() => onRemove(index)}
          variableAware={variableAware}
        />
      ))}
      {showAddButton && (
        <button
          type="button"
          onClick={() => setAddingRowId(lastRow.id)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-semibold text-primary hover:bg-muted/50"
        >
          <Plus className="size-3.5" />
          Add {itemLabel}
        </button>
      )}
    </div>
  );
});
