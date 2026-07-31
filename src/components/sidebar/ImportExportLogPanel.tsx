import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, History, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ImportExportLogEntry, formatRelativeTime } from "@/lib/importExportLog";

function formatLogEntrySummary(entry: ImportExportLogEntry): string {
  if (entry.status === "error") {
    const action = entry.direction === "import" ? "Import" : "Export";
    return `${action} failed: ${entry.label}`;
  }
  const action = entry.direction === "import" ? "Imported" : "Exported";
  const detail = entry.detail ? ` (${entry.detail})` : "";
  return `${action} "${entry.label}"${detail}`;
}

function logEntryDialogTitle(entry: ImportExportLogEntry): string {
  const operation = entry.direction === "import" ? "Import" : "Export";
  const result = entry.status === "success" ? "succeeded" : "failed";
  return `${operation} ${result}`;
}

function logEntryDetailLabel(entry: ImportExportLogEntry): string {
  if (entry.status === "error") return "File";
  return entry.kind === "environment" ? "Environment" : "Collection";
}

interface ImportExportLogPanelProps {
  log: readonly ImportExportLogEntry[];
}

export function ImportExportLogPanel({ log }: ImportExportLogPanelProps) {
  const [detailEntry, setDetailEntry] = useState<ImportExportLogEntry | null>(null);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full shrink-0 justify-start gap-2 px-2 text-muted-foreground hover:text-foreground"
          >
            <History className="size-3.5" />
            Import/Export Log
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-80 p-2">
          {log.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No imports or exports yet.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {log.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setDetailEntry(entry)}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                >
                  {entry.status === "success" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{formatLogEntrySummary(entry)}</p>
                    {entry.message && <p className="truncate text-xs text-destructive">{entry.message}</p>}
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(entry.timestamp)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={detailEntry !== null} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent>
          {detailEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      detailEntry.status === "success" ? "bg-success" : "bg-destructive"
                    )}
                    aria-hidden
                  />
                  {logEntryDialogTitle(detailEntry)}
                </DialogTitle>
                <DialogDescription>{new Date(detailEntry.timestamp).toLocaleString()}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{logEntryDetailLabel(detailEntry)}: </span>
                  {detailEntry.label}
                </div>
                {detailEntry.detail && (
                  <div>
                    <span className="text-muted-foreground">
                      {detailEntry.kind === "environment" ? "Variables: " : "Contents: "}
                    </span>
                    {detailEntry.detail}
                  </div>
                )}
                {detailEntry.message && (
                  <div>
                    <span className="text-muted-foreground">Error:</span>
                    <p className="mt-1 rounded-md bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap select-text">
                      {detailEntry.message}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
