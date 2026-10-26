
export class PostmanImportError extends Error {}

export function dedupeName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`;
    if (!existingNames.has(candidate)) return candidate;
  }
}
