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

// Bundled together (rather than 5 separate props) since they only ever
// travel as a set — the Value column below is variable-aware only when
// this whole set is provided.
export interface VariableAwareProps {
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onCreateVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}

// Shared column template for the header label row and every data row below
// it — checkbox / key / value / trash, in that order. One definition both
// live in means the columns are structurally guaranteed to line up (a grid
// track is a grid track); no more matching flex-basis/min-width by hand
// across locked vs. editable rows, which is what caused the repeated
// mis-alignment bugs the flex-based version had.
const GRID_COLUMNS = "grid grid-cols-[16px_1fr_1fr_32px] items-center gap-2";

// One shared row shape for both the locked (read-only default headers) and
// editable rows — a single markup path they both render through, rather than
// two hand-copied JSX blocks that only stay in sync if someone remembers to
// update both.
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
  // The row just revealed by "+ Add" — focus its Key field immediately
  // rather than making the user click into it themselves.
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
  // Read-only rows shown above the editable ones — e.g. default headers
  // that are sent automatically. Not part of `rows`/persisted data; purely
  // informational, so there's no enabled/remove affordance for them.
  lockedRows?: { key: string; value: string }[];
  // Omitted by the Environment editor, which uses this same component to
  // edit a variable's own raw value — {{var}} coloring/hover against the
  // variable currently being defined isn't in scope there. When omitted,
  // the Value column falls back to a plain Input.
  variableAware?: VariableAwareProps;
  // Label for the "+ Add ___" button — e.g. "header", "param", "variable".
  itemLabel?: string;
}) {
  // `rows` always keeps exactly one trailing blank entry (see
  // ensureTrailingBlankRow/updateRows in lib/keyValue.ts) so there's
  // somewhere to type a new row into — but showing that blank row as a live
  // input all the time doesn't match the design (an explicit "+ Add" button
  // instead). So it stays hidden, replaced by the button, until the button
  // is clicked; comparing ids (not just "is blank") means the button
  // reappears on its own once *this* row fills in and a fresh blank one
  // takes its place, without needing to reset any state manually.
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
