import type { KeyValuePair } from "@/lib/keyValue";

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
}

export function createEnvironment(name: string): Environment {
  return {
    id: crypto.randomUUID(),
    name,
    variables: [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }],
  };
}

// New environments are named after world capitals rather than "Environment
// N" — picking the first one not already in use also sidesteps the old
// collision bug where a count-based number (existing.length + 1) drifted out
// of sync once something in the middle of the list got deleted.
const CAPITAL_NAMES = [
  "Amsterdam", "Ankara", "Athens", "Baghdad", "Bangkok", "Beijing", "Berlin", "Bogota",
  "Brasilia", "Brussels", "Bucharest", "Budapest", "Buenos Aires", "Cairo", "Canberra",
  "Copenhagen", "Dakar", "Damascus", "Dhaka", "Dublin", "Hanoi", "Havana", "Helsinki",
  "Islamabad", "Jakarta", "Kyiv", "Lima", "Lisbon", "London", "Madrid", "Manila",
  "Mexico City", "Vilnius", "Nairobi", "New Delhi", "Oslo", "Ottawa", "Paris", "Prague",
  "Quito", "Riga", "Riyadh", "Rome", "Santiago", "Seoul", "Singapore", "Sofia",
  "Stockholm", "Tallinn", "Tokyo", "Vienna", "Warsaw", "Wellington", "Zagreb",
];

export function nextEnvironmentName(existing: Environment[]): string {
  const usedNames = new Set(existing.map((e) => e.name));
  const capital = CAPITAL_NAMES.find((name) => !usedNames.has(name));
  if (capital) return capital;
  // Every capital in the list is already taken — cycle through the list
  // again with an incrementing suffix ("London 2", "Paris 2", ...) rather
  // than switching to a differently-themed fallback name.
  for (let iteration = 2; ; iteration++) {
    const capitalForIteration = CAPITAL_NAMES.find(
      (name) => !usedNames.has(`${name} ${iteration}`)
    );
    if (capitalForIteration) return `${capitalForIteration} ${iteration}`;
  }
}

// Replaces {{varName}} with the matching enabled variable's value from the
// active environment. Unresolved placeholders (no active environment, or no
// matching enabled variable) are left as-is — substitution only ever happens
// on a copy used for validation/sending, never written back into state, so
// the raw {{varName}} stays visible and editable in the UI.
export function substituteVariables(text: string, environment: Environment | null): string {
  if (!environment) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, name) => {
    const variable = environment.variables.find((v) => v.enabled && v.key === name);
    return variable ? variable.value : placeholder;
  });
}

export function findVariableNames(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
}

// Scans the given texts for {{varName}} placeholders that wouldn't resolve
// against the active environment, for a non-blocking UI hint.
export function getUnresolvedVariables(texts: string[], environment: Environment | null): string[] {
  const resolvedKeys = new Set(
    (environment?.variables ?? [])
      .filter((v) => v.enabled && v.key.trim() !== "")
      .map((v) => v.key)
  );
  const unresolved = new Set<string>();
  for (const text of texts) {
    for (const name of findVariableNames(text)) {
      if (!resolvedKeys.has(name)) unresolved.add(name);
    }
  }
  return [...unresolved];
}
