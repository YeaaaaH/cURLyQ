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

// "Failure" for v1 is deliberately simple — non-2xx status or a network
// error — since there's no assertion API (a pm.test() equivalent) in the
// scripting engine yet to base pass/fail on. See .tasks/plan.md's
// "Collection run" section.
function isOk(response: HttpResponse | null): boolean {
  return response !== null && response.status >= 200 && response.status < 300;
}

// Sequentially sends every request in `requests`, in the order given —
// continuing past a failure rather than stopping, so one broken request
// doesn't hide the results of everything after it. Reuses the same
// pre-script -> send -> post-script pipeline a live request tab uses
// (`sendRequestWithScripts`).
//
// Chains data between steps the same way a single tab's own pre/post-script
// pair does within one send: `accumulatedPatch` collects every
// `ctx.environment.set()` call made so far this run and gets layered on top
// of the real active environment for every later step, both for variable
// substitution (`withEnvironmentPatch`) and for what a step's own scripts see
// via `ctx.environment.get()`/`toObject()` — the live `environment` argument
// alone wouldn't reflect an earlier step's patch mid-run, since committing it
// to real app state is an async React update this loop doesn't wait on.
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

    // A quick-added request whose URL was never actually saved (the tab
    // edit never got persisted back to the collection) reaches here with a
    // literal empty string — reqwest rejects that with an opaque "builder
    // error" that gives no hint what's wrong. Report it plainly instead of
    // sending.
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
