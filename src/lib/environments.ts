import { type KeyValuePair, ensureTrailingBlankRow, stripEmptyRows } from "@/lib/keyValue";
import { PostmanImportError, dedupeName } from "@/lib/postman";

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

const CAPITAL_NAMES = [
  "Amsterdam", "Ankara", "Athens", "Baghdad", "Bangkok", "Beijing", "Berlin", "Bogota",
  "Brasilia", "Brussels", "Bucharest", "Budapest", "Buenos Aires", "Cairo", "Canberra",
  "Copenhagen", "Dakar", "Damascus", "Dhaka", "Dublin", "Hanoi", "Havana", "Helsinki",
  "Islamabad", "Jakarta", "Kyiv", "Lima", "Lisbon", "London", "Madrid", "Manila",
  "Mexico City", "Vilnius", "Nairobi", "New Delhi", "Oslo", "Ottawa", "Paris", "Prague",
  "Quito", "Riga", "Riyadh", "Rome", "Santiago", "Seoul", "Singapore", "Sofia",
  "Stockholm", "Tallinn", "Tokyo", "Vienna", "Warsaw", "Wellington", "Zagreb",
];

export function filterEnvironments(environments: readonly Environment[], query: string): Environment[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") return environments as Environment[];
  return environments.filter((environment) => environment.name.toLowerCase().includes(trimmed));
}

export function nextEnvironmentName(existing: Environment[]): string {
  const usedNames = new Set(existing.map((e) => e.name));
  const capital = CAPITAL_NAMES.find((name) => !usedNames.has(name));
  if (capital) return capital;
  for (let iteration = 2; ; iteration++) {
    const capitalForIteration = CAPITAL_NAMES.find(
      (name) => !usedNames.has(`${name} ${iteration}`)
    );
    if (capitalForIteration) return `${capitalForIteration} ${iteration}`;
  }
}

export function buildPostmanEnvironment(environment: Environment) {
  return {
    id: environment.id,
    name: environment.name,
    values: stripEmptyRows(environment.variables).map(({ key, value, enabled }) => ({
      key,
      value,
      type: "default",
      enabled,
    })),
    _postman_variable_scope: "environment",
    _postman_exported_at: new Date().toISOString(),
  };
}

interface PostmanEnvironmentValue {
  key?: unknown;
  value?: unknown;
  enabled?: unknown;
}

export function parsePostmanEnvironment(json: unknown, existing: Environment[]): Environment {
  if (typeof json !== "object" || json === null) {
    throw new PostmanImportError("Not a valid JSON file.");
  }
  const data = json as Record<string, unknown>;

  if (Array.isArray(data.item)) {
    throw new PostmanImportError(
      "This looks like a Postman collection, not an environment — collection import isn't supported yet."
    );
  }
  if (!Array.isArray(data.values)) {
    throw new PostmanImportError('Missing a "values" array — not a Postman environment file.');
  }

  const variables: KeyValuePair[] = data.values
    .filter((v): v is PostmanEnvironmentValue => typeof v === "object" && v !== null && typeof v.key === "string")
    .map((v) => ({
      id: crypto.randomUUID(),
      key: v.key as string,
      value: typeof v.value === "string" ? v.value : "",
      enabled: v.enabled !== false,
    }));

  const rawName = typeof data.name === "string" && data.name.trim() !== "" ? data.name.trim() : "Imported environment";

  return {
    id: crypto.randomUUID(),
    name: dedupeName(rawName, new Set(existing.map((e) => e.name))),
    variables: ensureTrailingBlankRow(stripEmptyRows(variables)),
  };
}
