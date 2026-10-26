// Allows - and . for Postman-style keys like {{api-gateway}} or {{service.host}}.
export const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

export interface VariableToken {
  name: string;
  start: number;
  end: number;
}

export function tokenizeVariables(text: string): VariableToken[] {
  return [...text.matchAll(VARIABLE_PATTERN)].map((match) => {
    const start = match.index ?? 0;
    return { name: match[1], start, end: start + match[0].length };
  });
}
