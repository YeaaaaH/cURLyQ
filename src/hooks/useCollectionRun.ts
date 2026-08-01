import { useCallback } from "react";
import { toast } from "sonner";
import type { VariableLookup } from "@/lib/variables/context";
import type { Environment } from "@/lib/environments";
import { type Collection, type CollectionNode, type RequestNode, collectRequestNodes } from "@/lib/collections";
import { runCollectionRequests } from "@/lib/collectionRun";

interface UseCollectionRunParams {
  collections: Collection[];
  variableContext: VariableLookup;
  activeEnvironment: Environment | null;
  applyEnvironmentPatch: (patch: Record<string, string>) => void;
}

// Placeholder reporting via toast, until a dedicated results tab exists to
// show per-request detail (planned as a follow-up piece — see
// .tasks/plan.md's "Collection run" section).
export function useCollectionRun({
  collections,
  variableContext,
  activeEnvironment,
  applyEnvironmentPatch,
}: UseCollectionRunParams) {
  const runAndReport = useCallback(
    async (requests: RequestNode[], label: string) => {
      if (requests.length === 0) {
        toast.info(`"${label}" has no requests to run.`);
        return;
      }
      const result = await runCollectionRequests(requests, variableContext, activeEnvironment, applyEnvironmentPatch);
      const summary = `${result.passed}/${result.steps.length} passed`;
      if (result.failed === 0) {
        toast.success(`Ran "${label}" — ${summary}`);
      } else {
        const failedNames = result.steps
          .filter((s) => !s.ok)
          .map((s) => s.requestName)
          .join(", ");
        toast.error(`Ran "${label}" — ${summary}`, { description: `Failed: ${failedNames}` });
      }
    },
    [variableContext, activeEnvironment, applyEnvironmentPatch]
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
