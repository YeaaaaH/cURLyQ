// Shared between environments.ts and collections.ts — both map to/from
// Postman v2.1 JSON and need the same "name already in use" dedupe plus a
// common error type, so App.tsx can catch either import with one
// `instanceof` check regardless of which kind of file it was.

export class PostmanImportError extends Error {}

// Keeps an imported name recognizable ("Dev", "Dev (2)", ...) instead of
// generating an unrelated new one — an imported file already has a name the
// user picked, we just need to keep it unique among what's already there.
export function dedupeName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`;
    if (!existingNames.has(candidate)) return candidate;
  }
}
