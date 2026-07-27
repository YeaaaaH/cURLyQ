// Variable names aren't limited to \w — Postman-style keys commonly use
// kebab-case (e.g. {{api-gateway}}) or dotted namespacing (e.g.
// {{service.host}}), neither of which \w alone matches.
export const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export interface VariableToken {
  name: string;
  start: number;
  end: number;
}

// Pure detection only — no resolution. `start`/`end` are string indices into
// `text` (not pixel positions), so callers can use them directly as
// CodeMirror decoration ranges or to slice the source string.
export function tokenizeVariables(text: string): VariableToken[] {
  return [...text.matchAll(VARIABLE_PATTERN)].map((match) => {
    const start = match.index ?? 0;
    return { name: match[1], start, end: start + match[0].length };
  });
}
