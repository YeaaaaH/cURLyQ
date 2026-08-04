import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";
import { baseExtensions } from "@/components/codemirror/theme";
import { useCodeMirrorEditor } from "@/components/codemirror/useCodeMirrorEditor";
import { setVariableAwareConfig } from "@/components/codemirror/variableAwareConfig";
import { variableDecorations } from "@/components/codemirror/variableDecorations";
import { variableHoverTooltip } from "@/components/codemirror/variableHoverTooltip";

// CodeMirror's own decorations (variableDecorations.ts) and hover tooltip
// (variableHoverTooltip.tsx) replace what used to be a hand-rolled overlay
// <div> stacked on top of an invisible <textarea> — see git history for
// that version if you need the old approach for reference. Body content is
// JSON-*ish* (getBodyError in requestTabs.ts tolerates `//`/`/* */`
// comments before parsing), so the JavaScript language mode is used rather
// than a strict JSON parser that would flag those comments as errors.
export function VariableAwareTextarea({
  value,
  onChange,
  environment,
  variableContext,
  onUpdateVariable,
  onCreateVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
  placeholder,
  ariaInvalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onCreateVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
  placeholder?: string;
  ariaInvalid?: boolean;
  className?: string;
}) {
  const { containerRef, viewRef } = useCodeMirrorEditor({
    value,
    onChange,
    extensions: [
      javascript(),
      variableDecorations(),
      variableHoverTooltip(),
      // Strips CodeMirror's default tooltip chrome (white background,
      // border) — VariableHoverPopupContent already supplies its own
      // bg-popover/shadow/ring styling, matching the popup used elsewhere.
      EditorView.theme({ ".cm-tooltip": { border: "none", backgroundColor: "transparent" } }),
      ...baseExtensions(placeholder),
    ],
  });

  // Pushes the current environment/variableContext/callbacks into
  // CodeMirror's own state — see variableAwareConfig.ts for why this can't
  // just be a closed-over prop. Runs after the view exists (the mount
  // effect inside useCodeMirrorEditor always runs first — see its own
  // comment), so the very first paint already has live values, not the
  // field's no-op defaults.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: setVariableAwareConfig.of({
        environment,
        variableContext,
        onUpdateVariable,
        onCreateVariable,
        onOpenEnvironment,
        onOpenVariablesPanel,
      }),
    });
  }, [environment, variableContext, onUpdateVariable, onCreateVariable, onOpenEnvironment, onOpenVariablesPanel]);

  return (
    <div
      ref={containerRef}
      aria-invalid={ariaInvalid}
      className={cn("h-full min-h-0 w-full flex-1 aria-invalid:ring-2 aria-invalid:ring-destructive", className)}
    />
  );
}
