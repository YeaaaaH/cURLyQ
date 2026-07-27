import type { VariableLookup } from "@/lib/variables/context";
import { resolveVariable } from "@/lib/variables/resolver";
import { tokenizeVariables } from "@/lib/variables/tokenizer";

// Every distinct {{varName}} used anywhere across the given texts (resolved
// or not) — used by the "Variables in request" panel, which needs the full
// set, not just the broken ones.
export function findAllVariableNames(texts: string[]): string[] {
  const names = new Set<string>();
  for (const text of texts) {
    for (const token of tokenizeVariables(text)) names.add(token.name);
  }
  return [...names];
}

// Scans the given texts for {{varName}} placeholders that wouldn't resolve
// against the current variable context, for a non-blocking UI hint. A
// circular reference counts as unresolved here — this one summary line
// doesn't need to distinguish the two failure modes, only per-token UI does.
export function getUnresolvedVariables(texts: string[], context: VariableLookup): string[] {
  return findAllVariableNames(texts).filter((name) => resolveVariable(name, context).kind !== "resolved");
}
