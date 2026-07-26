// bash's only way to embed a literal single quote inside a single-quoted
// string: close the quote, insert an escaped quote, reopen — 'it'\''s' means
// "it's". Targets the common case (pasting into bash); not guaranteed to
// paste cleanly into PowerShell/cmd, which escape differently.
function escapeSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

// Formats a request as an equivalent curl command — a copy-paste-ready
// preview of exactly what's being sent, after variable substitution.
export function buildCurlCommand(
  method: string,
  url: string,
  headers: [string, string][],
  body: string | null
): string {
  const lines = [`curl -X ${method} '${escapeSingleQuoted(url)}'`];
  for (const [key, value] of headers) {
    lines.push(`  -H '${escapeSingleQuoted(`${key}: ${value}`)}'`);
  }
  if (body !== null && body.trim() !== "") {
    lines.push(`  --data '${escapeSingleQuoted(body)}'`);
  }
  return lines.join(" \\\n");
}
