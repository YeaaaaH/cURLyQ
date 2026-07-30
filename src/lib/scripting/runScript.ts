import type { ScriptHalf, ScriptRunResult, ScriptWorkerMessage } from "./types";

// Wall-clock cutoff for a single script run — guards against an infinite
// loop in user script code hanging Send indefinitely. The worker is
// terminated (not just abandoned) so it can't keep burning CPU in the
// background after the timeout fires.
const SCRIPT_TIMEOUT_MS = 5000;

interface RunScriptParams {
  script: string;
  kind: ScriptHalf;
  environment: Record<string, string>;
  // Only ever sent for a pre-request run — post-response scripts don't get a
  // ctx.request (see sandbox.worker.ts's design note).
  request?: { headers: Record<string, string>; body: string };
  response?: { status: number; headers: Record<string, string>; body: string };
}

// Spins up a fresh worker per run (rather than a reusable one) so each
// script starts from a genuinely clean global scope, and so terminating a
// timed-out worker can't accidentally affect a later run. This never
// rejects — callers always get a ScriptRunResult, timeout/crash included —
// so handleSend doesn't need a separate error path for "the script itself
// blew up" vs. "the script ran fine".
function runInWorker(params: RunScriptParams): Promise<ScriptRunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url), { type: "module" });
    let settled = false;

    // Built up incrementally as ScriptWorkerMessages arrive, rather than
    // read off a single final message — so a timed-out (terminated) worker
    // still resolves with whatever it managed to do before it hung, instead
    // of an empty result. `kind: "pre-request"` is implicit in whether any
    // header/body messages ever arrive at all (only a pre-request run's
    // ctx.request exists to produce them).
    const logs: string[] = [];
    const environmentPatch: Record<string, string> = {};
    const headersPatch: Record<string, string> = {};
    let bodyPatch: string | undefined;

    function buildResult(ok: boolean, error: string | null): ScriptRunResult {
      const hasRequestPatch = Object.keys(headersPatch).length > 0 || bodyPatch !== undefined;
      return {
        ok,
        logs,
        error,
        environmentPatch,
        ...(hasRequestPatch
          ? {
              requestPatch: {
                headers: Object.keys(headersPatch).length > 0 ? headersPatch : undefined,
                body: bodyPatch,
              },
            }
          : {}),
      };
    }

    function settle(result: ScriptRunResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    }

    const timeout = setTimeout(() => {
      settle(buildResult(false, `Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s (possible infinite loop).`));
    }, SCRIPT_TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<ScriptWorkerMessage>) => {
      const message = e.data;
      switch (message.type) {
        case "log":
          logs.push(message.line);
          break;
        case "environmentSet":
          environmentPatch[message.key] = message.value;
          break;
        case "headerSet":
          headersPatch[message.key] = message.value;
          break;
        case "bodySet":
          bodyPatch = message.value;
          break;
        case "done":
          settle(buildResult(message.ok, message.error));
          break;
      }
    };

    worker.onerror = (e) => settle(buildResult(false, e.message || "Script crashed the sandbox worker."));

    worker.postMessage(params);
  });
}

export function runPreRequestScript(
  script: string,
  request: { headers: Record<string, string>; body: string },
  environment: Record<string, string>
): Promise<ScriptRunResult> {
  return runInWorker({ script, kind: "pre-request", environment, request });
}

export function runPostResponseScript(
  script: string,
  response: { status: number; headers: Record<string, string>; body: string },
  environment: Record<string, string>
): Promise<ScriptRunResult> {
  return runInWorker({ script, kind: "post-response", environment, response });
}
