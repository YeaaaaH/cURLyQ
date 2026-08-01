import type { RequestTab } from "@/lib/requestTabs";
import type { CollectionRunResult } from "@/lib/collectionRun";

// A finished Collection Run's results, shown as its own tab in the same
// strip as request tabs (rather than a separate view) — never persisted,
// since it's a snapshot of a past action, not an editable document.
export interface RunResultTab {
  type: "run-result";
  id: string;
  label: string;
  result: CollectionRunResult;
}

export type Tab = RequestTab | RunResultTab;

export function createRunResultTab(label: string, result: CollectionRunResult): RunResultTab {
  return { type: "run-result", id: crypto.randomUUID(), label, result };
}
