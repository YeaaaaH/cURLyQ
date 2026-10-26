import { StateEffect, StateField } from "@codemirror/state";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";

// Extensions are read once on mount, so live props reach them through this StateField.
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
