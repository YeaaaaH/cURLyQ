import type { RequestTab } from "@/lib/requestTabs";
import type { CollectionRunResult } from "@/lib/collectionRun";

// Never persisted: a snapshot of a past run, not an editable document.
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
