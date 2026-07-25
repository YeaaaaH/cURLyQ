export interface ImportExportLogEntry {
  id: string;
  timestamp: number;
  direction: "import" | "export";
  kind: "environment" | "collection";
  // The environment/collection's own name on success; the picked/target file
  // name on failure, since a failed parse may never produce a name to show.
  label: string;
  // Pre-formatted, e.g. "12 variables" or "3 folders, 8 requests" — kept as
  // free text rather than a structured count so environments and collections
  // don't need separate fields for what's ultimately just a summary line.
  detail?: string;
  status: "success" | "error";
  message?: string;
}

const LOG_CAPACITY = 10;

export function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function pushLogEntry(
  log: ImportExportLogEntry[],
  entry: Omit<ImportExportLogEntry, "id" | "timestamp">
): ImportExportLogEntry[] {
  const full: ImportExportLogEntry = { ...entry, id: crypto.randomUUID(), timestamp: Date.now() };
  return [full, ...log].slice(0, LOG_CAPACITY);
}

export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.round((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}d ago`;
}
