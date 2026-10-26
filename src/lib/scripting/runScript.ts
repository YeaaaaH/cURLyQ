import type { ScriptHalf, ScriptRunResult, ScriptWorkerMessage } from "./types";

const SCRIPT_TIMEOUT_MS = 5000;

interface RunScriptParams {
  script: string;
  kind: ScriptHalf;
  environment: Record<string, string>;
  request?: { headers: Record<string, string>; body: string };
  response?: { status: number; headers: Record<string, string>; body: string };
}

// A fresh worker per run gives each script a clean global scope. Never
// rejects: a timeout or crash still resolves as a failed ScriptRunResult.
function runInWorker(params: RunScriptParams): Promise<ScriptRunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./sandbox.worker.ts", import.meta.url), { type: "module" });
    let settled = false;

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
