import type { Environment } from "@/lib/environments";

export interface VariableLookup {
  lookup(name: string): string | undefined;
}

export interface VariableScope {
  name: string;
  lookup(name: string): string | undefined;
}

export function environmentScope(environment: Environment | null): VariableScope {
  return {
    name: "environment",
    lookup(name) {
      const variable = environment?.variables.find((v) => v.enabled && v.key === name);
      return variable?.value;
    },
  };
}

// First match wins, in the order given.
export function createVariableContext(scopes: VariableScope[]): VariableLookup {
  return {
    lookup(name) {
      for (const scope of scopes) {
        const value = scope.lookup(name);
        if (value !== undefined) return value;
      }
      return undefined;
    },
  };
}
