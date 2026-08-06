import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Environment } from "@/lib/environments";
import { resolveVariable, tokenizeVariables, type VariableLookup } from "@/lib/variables";
import type { HoverState } from "@/components/variable-aware/useVariableTokenHover";

interface VariableHoverPopupContentProps {
  name: string;
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  // Adds `name` to the active environment as a new, empty-value variable —
  // the "unresolved" branch's quick-fix, so a typo'd/never-defined
  // `{{var}}` can be created on the spot instead of leaving the popup to do
  // it by hand in the full Environment editor.
  onCreateVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}

// The popup's actual content: resolved value (editable, unless the raw
// value contains a further {{other}} reference), an "unresolved"/"circular
// reference" notice, or links to the full Environment editor / Variables
// panel. Split out from `VariableHoverPopup` below so CodeMirror's own
// hover-tooltip extension (variableHoverTooltip.tsx, used by the Body
// editor) can render it directly into the tooltip DOM node CodeMirror
// already positions — without the portal/fixed-rect positioning that
// `VariableAwareInput` still needs, since it isn't CodeMirror-based.
export function VariableHoverPopupContent({
  name,
  environment,
  variableContext,
  onUpdateVariable,
  onCreateVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
}: VariableHoverPopupContentProps) {
  const resolution = resolveVariable(name, variableContext);
  // The value field only writes straight back into the variable's raw
  // value (via onUpdateVariable) when that raw value is a direct literal —
  // if it itself contains {{other}} tokens, editing the *resolved* text
  // here would silently overwrite that reference with a flattened literal,
  // destroying it.
  const rawValue = variableContext.lookup(name);
  const isDirectValue = rawValue !== undefined && tokenizeVariables(rawValue).length === 0;

  return (
    <div
      role="tooltip"
      className="flex flex-col gap-1.5 rounded-md bg-popover p-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10"
    >
      {resolution.kind === "unresolved" ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-destructive">{name} is unresolved</span>
          {environment && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => onCreateVariable(name)}
              className="h-auto shrink-0 p-0"
            >
              Create variable
            </Button>
          )}
        </div>
      ) : resolution.kind === "circular" ? (
        <span className="font-mono text-destructive">{resolution.chain.join(" → ")} — circular reference</span>
      ) : isDirectValue ? (
        <Input
          className="h-7 px-1.5 py-0 font-mono text-xs"
          size={Math.max(resolution.value.length, 1)}
          value={resolution.value}
          onChange={(e) => onUpdateVariable(name, e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs">{resolution.value}</span>
          <span className="text-[11px] text-muted-foreground">resolved via {rawValue}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2.5 whitespace-nowrap font-sans">
        {environment && (
          <Button type="button" variant="link" size="xs" onClick={onOpenEnvironment} className="h-auto p-0">
            Edit environment
          </Button>
        )}
        <Button type="button" variant="link" size="xs" onClick={onOpenVariablesPanel} className="h-auto gap-1 p-0">
          Variables in request
          <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}

// Shared by VariableAwareInput — positions VariableHoverPopupContent as a
// fixed-position portal below the hovered token's real DOM rect. (The Body
// editor no longer uses this: CodeMirror positions its own tooltips, so it
// renders VariableHoverPopupContent directly — see variableHoverTooltip.tsx.)
export function VariableHoverPopup({
  hover,
  environment,
  variableContext,
  onUpdateVariable,
  onCreateVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
  onMouseEnter,
  onMouseLeave,
}: {
  hover: HoverState;
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onCreateVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return createPortal(
    <div
      className="fixed z-50 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ top: hover.rect.bottom + 4, left: hover.rect.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <VariableHoverPopupContent
        name={hover.name}
        environment={environment}
        variableContext={variableContext}
        onUpdateVariable={onUpdateVariable}
        onCreateVariable={onCreateVariable}
        onOpenEnvironment={onOpenEnvironment}
        onOpenVariablesPanel={onOpenVariablesPanel}
      />
    </div>,
    document.body
  );
}
