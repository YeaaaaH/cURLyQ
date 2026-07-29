import { toast } from "sonner";
import { type ImportExportLogEntry } from "@/lib/importExportLog";
import { PostmanImportError } from "@/lib/postman";

interface ImportExportOperationResult {
  label: string;
  detail: string;
  // Only set when the toast should say something other than `detail` (e.g.
  // collection import calling out requests with an unsupported body).
  toastDescription?: string;
}

interface RunImportExportParams {
  onLogEntry: (entry: Omit<ImportExportLogEntry, "id" | "timestamp">) => void;
  direction: ImportExportLogEntry["direction"];
  kind: ImportExportLogEntry["kind"];
  // The name to log/toast on failure — the picked/target file name for
  // import (the real name isn't known until parsing succeeds), or the
  // environment/collection's own name for export (already known upfront).
  fallbackLabel: string;
  operation: () => Promise<ImportExportOperationResult>;
}

// Shared success/failure handling for the four import/export handlers
// (environment import, environment export, collection import, collection
// export) — each just supplies its own operation and lets this log the
// result and show the matching toast.
export async function runImportExportWithFeedback({
  onLogEntry,
  direction,
  kind,
  fallbackLabel,
  operation,
}: RunImportExportParams): Promise<void> {
  try {
    const { label, detail, toastDescription } = await operation();
    onLogEntry({ direction, kind, label, detail, status: "success" });
    const verb = direction === "import" ? "Imported" : "Exported";
    toast.success(`${verb} "${label}"`, { description: toastDescription ?? detail });
  } catch (err) {
    const message = err instanceof PostmanImportError ? err.message : String(err);
    onLogEntry({ direction, kind, label: fallbackLabel, status: "error", message });
    const verb = direction === "import" ? "import" : "export";
    toast.error(`Couldn't ${verb} "${fallbackLabel}"`, { description: message });
  }
}
