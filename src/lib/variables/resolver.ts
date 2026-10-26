import type { VariableLookup } from "@/lib/variables/context";
import { VARIABLE_PATTERN } from "@/lib/variables/tokenizer";

// Backstop against a pathological chain; real configs nest 2–3 levels.
export const MAX_RESOLUTION_DEPTH = 10;

export type VariableResolution =
  | { kind: "resolved"; value: string }
  | { kind: "unresolved" }
  // Also returned for a non-cyclic chain deeper than MAX_RESOLUTION_DEPTH.
  | { kind: "circular"; chain: string[] };

export function resolveVariable(name: string, context: VariableLookup): VariableResolution {
  return resolveInner(name, context, []);
}

function resolveInner(
  name: string,
  context: VariableLookup,
  chain: readonly string[]
): VariableResolution {
  if (chain.includes(name)) return { kind: "circular", chain: [...chain, name] };
  const nextChain = [...chain, name];
  if (nextChain.length > MAX_RESOLUTION_DEPTH) return { kind: "circular", chain: nextChain };

  const raw = context.lookup(name);
  if (raw === undefined) return { kind: "unresolved" };
  return substituteInner(raw, context, nextChain);
}

function substituteInner(
  text: string,
  context: VariableLookup,
  chain: readonly string[]
): VariableResolution {
  let sawUnresolved = false;
  let circularChain: string[] | null = null;

  const value = text.replace(VARIABLE_PATTERN, (placeholder, name) => {
    if (circularChain) return placeholder;
    const result = resolveInner(name, context, chain);
    if (result.kind === "resolved") return result.value;
    if (result.kind === "circular") {
      circularChain = result.chain;
      return placeholder;
    }
    sawUnresolved = true;
    return placeholder;
  });

  if (circularChain) return { kind: "circular", chain: circularChain };
  if (sawUnresolved) return { kind: "unresolved" };
  return { kind: "resolved", value };
}

// Unresolved and circular tokens are left as the literal {{name}}.
export function substituteVariables(text: string, context: VariableLookup): string {
  return text.replace(VARIABLE_PATTERN, (placeholder, name) => {
    const result = resolveInner(name, context, []);
    return result.kind === "resolved" ? result.value : placeholder;
  });
}
