import type { VariableLookup } from "@/lib/variables/context";
import { VARIABLE_PATTERN } from "@/lib/variables/tokenizer";

// A generous ceiling on how many variables deep a chain of {{a}} -> {{b}} ->
// {{c}} -> ... references can go before it's treated as circular. Real
// configs nest at most 2-3 levels deep; this is just a backstop against a
// pathological/typo'd chain looping (or recursing) forever.
export const MAX_RESOLUTION_DEPTH = 10;

export type VariableResolution =
  | { kind: "resolved"; value: string }
  | { kind: "unresolved" }
  // `chain` is the sequence of variable names visited, e.g. ["a", "b", "a"]
  // for a direct a<->b cycle, or a straight-line chain longer than
  // MAX_RESOLUTION_DEPTH if nothing actually cycles but nests too deep.
  | { kind: "circular"; chain: string[] };

// Fully (recursively) resolves one named variable — if its own raw value
// contains further {{...}} tokens, those are resolved too. Detects both
// direct and indirect cycles via the `chain` of names already being resolved
// in this call.
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

// Best-effort string substitution: replaces every {{name}} it can resolve
// (recursively) and leaves anything unresolved OR circular as the literal
// {{name}} placeholder. Used everywhere a plain string is needed to keep
// going — building the outgoing URL/headers/body, the cURL preview — rather
// than something that can fail outright on a bad variable.
export function substituteVariables(text: string, context: VariableLookup): string {
  return text.replace(VARIABLE_PATTERN, (placeholder, name) => {
    const result = resolveInner(name, context, []);
    return result.kind === "resolved" ? result.value : placeholder;
  });
}
