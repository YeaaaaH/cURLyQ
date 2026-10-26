import { toast } from "sonner";
import { type ImportExportLogEntry } from "@/lib/importExportLog";
import { PostmanImportError } from "@/lib/postman";

interface ImportExportOperationResult {
  label: string;
  detail: string;
  toastDescription?: string;
}

interface RunImportExportParams {
  onLogEntry: (entry: Omit<ImportExportLogEntry, "id" | "timestamp">) => void;
  direction: ImportExportLogEntry["direction"];
  kind: ImportExportLogEntry["kind"];
  // On import the real name is unknown until parsing succeeds, so this is the file name.
  fallbackLabel: string;
  operation: () => Promise<ImportExportOperationResult>;
}

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
