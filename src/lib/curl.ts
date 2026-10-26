// Bash quoting ('it'\''s' means "it's"); PowerShell/cmd escape differently.
function escapeSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

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
