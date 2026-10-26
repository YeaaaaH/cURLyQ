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

// JavaScript mode, not JSON: bodies may contain `//` and `/* */` comments
// (stripped before sending), which a JSON parser would flag as errors.
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
      EditorView.theme({ ".cm-tooltip": { border: "none", backgroundColor: "transparent" } }),
      ...baseExtensions(placeholder),
    ],
  });

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
