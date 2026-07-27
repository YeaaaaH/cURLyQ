import type { Environment } from "@/lib/environments";

// The one interface every other variable module depends on, instead of
// `Environment | null` directly — so a future second variable scope (e.g.
// collection-level variables) only needs a new `VariableScope`, not a
// signature change everywhere that resolves a variable.
export interface VariableLookup {
  lookup(name: string): string | undefined;
}

export interface VariableScope {
  // Label only, for future diagnostics (e.g. "resolved from environment" vs
  // "resolved from collection") — not used for merge logic yet.
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

// First-match-wins across scopes, in the order given — this is the scope
// "precedence" a multi-scope future needs. Only ever called with a single
// `environmentScope` today.
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
