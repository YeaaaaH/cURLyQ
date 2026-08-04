import { StateEffect, StateField } from "@codemirror/state";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";

// The Body editor's variable-token decorations and hover tooltip both need
// the current environment/variableContext/callbacks — but CodeMirror
// extensions are only read once, on mount (see useCodeMirrorEditor's
// comment), while these can change on almost any render (switching the
// active environment, editing a variable elsewhere). A StateField holds the
// *current* value inside CodeMirror's own state, updated by dispatching
// `setVariableAwareConfig` whenever the caller's props change — both
// `variableDecorations.ts` and `variableHoverTooltip.tsx` read it fresh off
// `view.state` rather than closing over a stale React prop.
export interface VariableAwareConfig {
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateVariable: (name: string, value: string) => void;
  onCreateVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}

const noopConfig: VariableAwareConfig = {
  environment: null,
  variableContext: { lookup: () => undefined },
  onUpdateVariable: () => {},
  onCreateVariable: () => {},
  onOpenEnvironment: () => {},
  onOpenVariablesPanel: () => {},
};

export const setVariableAwareConfig = StateEffect.define<VariableAwareConfig>();

export const variableAwareConfigField = StateField.define<VariableAwareConfig>({
  create() {
    return noopConfig;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setVariableAwareConfig)) return effect.value;
    }
    return value;
  },
});
