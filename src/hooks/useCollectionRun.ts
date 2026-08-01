import { useCallback } from "react";
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
  const runAndReport = useCallback(
    async (requests: RequestNode[], label: string) => {
      if (requests.length === 0) {
        toast.info(`"${label}" has no requests to run.`);
        return;
      }
      const result = await runCollectionRequests(requests, variableContext, activeEnvironment, applyEnvironmentPatch);
      addRunResultTab(label, result);
    },
    [variableContext, activeEnvironment, applyEnvironmentPatch, addRunResultTab]
  );

  const handleRunCollection = useCallback(
    (id: string) => {
      const collection = collections.find((c) => c.id === id);
      if (!collection) return;
      runAndReport(collection.items.flatMap(collectRequestNodes), collection.name);
    },
    [collections, runAndReport]
  );

  const handleRunNode = useCallback(
    (_collectionId: string, node: CollectionNode) => {
      runAndReport(collectRequestNodes(node), node.name);
    },
    [runAndReport]
  );

  return { handleRunCollection, handleRunNode };
}
