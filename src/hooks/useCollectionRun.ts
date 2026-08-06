import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { VariableLookup } from "@/lib/variables/context";
import type { Environment } from "@/lib/environments";
import { type Collection, type CollectionNode, type RequestNode, collectRequestNodes } from "@/lib/collections";
import { runCollectionRequests, type CollectionRunResult } from "@/lib/collectionRun";

interface UseCollectionRunParams {
  collections: Collection[];
  variableContext: VariableLookup;
  activeEnvironment: Environment | null;
  applyEnvironmentPatch: (patch: Record<string, string>) => void;
  addRunResultTab: (label: string, result: CollectionRunResult) => void;
}

export function useCollectionRun({
  collections,
  variableContext,
  activeEnvironment,
  applyEnvironmentPatch,
  addRunResultTab,
}: UseCollectionRunParams) {
  // Which collection/folder node is currently running, so the tree can show
  // a spinner on that row instead of leaving the Run action's completion
  // invisible until the result tab appears.
  const [runningId, setRunningId] = useState<string | null>(null);

  const runAndReport = useCallback(
    async (id: string, requests: RequestNode[], label: string) => {
      if (requests.length === 0) {
        toast.info(`"${label}" has no requests to run.`);
        return;
      }
      setRunningId(id);
      try {
        const result = await runCollectionRequests(requests, variableContext, activeEnvironment, applyEnvironmentPatch);
        addRunResultTab(label, result);
      } finally {
        setRunningId(null);
      }
    },
    [variableContext, activeEnvironment, applyEnvironmentPatch, addRunResultTab]
  );

  const handleRunCollection = useCallback(
    (id: string) => {
      const collection = collections.find((c) => c.id === id);
      if (!collection) return;
      runAndReport(id, collection.items.flatMap(collectRequestNodes), collection.name);
    },
    [collections, runAndReport]
  );

  const handleRunNode = useCallback(
    (_collectionId: string, node: CollectionNode) => {
      runAndReport(node.id, collectRequestNodes(node), node.name);
    },
    [runAndReport]
  );

  return { handleRunCollection, handleRunNode, runningId };
}
