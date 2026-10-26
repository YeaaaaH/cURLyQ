import type { VariableLookup } from "@/lib/variables/context";
import { resolveVariable } from "@/lib/variables/resolver";
import { tokenizeVariables } from "@/lib/variables/tokenizer";

export function findAllVariableNames(texts: string[]): string[] {
  const names = new Set<string>();
  for (const text of texts) {
    for (const token of tokenizeVariables(text)) names.add(token.name);
  }
  return [...names];
}

// Circular references count as unresolved here.
export function getUnresolvedVariables(texts: string[], context: VariableLookup): string[] {
  return findAllVariableNames(texts).filter((name) => resolveVariable(name, context).kind !== "resolved");
}
