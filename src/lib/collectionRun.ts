import type { VariableLookup } from "@/lib/variables/context";
import type { Environment } from "@/lib/environments";
import type { HttpResponse } from "@/lib/http";
import type { RequestNode } from "@/lib/collections";
import type { LastScriptRun } from "@/lib/requestTabs";
import { environmentToRecord, sendRequestWithScripts, withEnvironmentPatch } from "@/lib/requestSend";

export interface CollectionRunStepResult {
  requestId: string;
  requestName: string;
  method: string;
  url: string;
  ok: boolean;
  response: HttpResponse | null;
  error: string | null;
  scriptRun: LastScriptRun;
  durationMs: number;
}

export interface CollectionRunResult {
  steps: CollectionRunStepResult[];
  passed: number;
  failed: number;
}

function isOk(response: HttpResponse | null): boolean {
  return response !== null && response.status >= 200 && response.status < 300;
}

export async function runCollectionRequests(
  requests: RequestNode[],
  variableContext: VariableLookup,
  environment: Environment | null,
  applyEnvironmentPatch: (patch: Record<string, string>) => void
): Promise<CollectionRunResult> {
  const baseRecord = environmentToRecord(environment);
  const accumulatedPatch: Record<string, string> = {};
  const steps: CollectionRunStepResult[] = [];

  for (const request of requests) {
    const startedAt = performance.now();

    // reqwest's error for an empty URL is an opaque "builder error".
    if (request.url.trim() === "") {
      steps.push({
        requestId: request.id,
        requestName: request.name,
        method: request.method,
        url: request.url,
        ok: false,
        response: null,
        error: "No URL set",
        scriptRun: { pre: null, post: null },
        durationMs: Math.round(performance.now() - startedAt),
      });
      continue;
    }

    const result = await sendRequestWithScripts(
      request,
      withEnvironmentPatch(variableContext, accumulatedPatch),
      { ...baseRecord, ...accumulatedPatch },
      (patch) => {
        applyEnvironmentPatch(patch);
        Object.assign(accumulatedPatch, patch);
      }
    );

    steps.push({
      requestId: request.id,
      requestName: request.name,
      method: request.method,
      url: request.url,
      ok: isOk(result.response),
      response: result.response,
      error: result.error,
      scriptRun: result.scriptRun,
      durationMs: Math.round(performance.now() - startedAt),
    });
  }

  const passed = steps.filter((s) => s.ok).length;
  return { steps, passed, failed: steps.length - passed };
}
