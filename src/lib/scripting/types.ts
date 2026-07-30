// Shared shape between the sandbox worker and the UI that displays a
// script's last run — see .tasks plan for pre-request/post-response
// scripts. `environmentPatch` is applied back onto the active environment
// after a run; `requestPatch` only ever comes from a pre-request script.
export interface ScriptRunResult {
  ok: boolean;
  logs: string[];
  error: string | null;
  environmentPatch: Record<string, string>;
  requestPatch?: {
    headers?: Record<string, string>;
    body?: string;
  };
}

export type ScriptHalf = "pre-request" | "post-response";

// Streamed from sandbox.worker.ts to runScript.ts as a script executes — one
// message per side effect (a console.* call, or a ctx.*.set call) instead of
// a single result sent only once the whole script finishes. This means a
// script that hangs partway through (an infinite loop right after a few
// ctx.environment.set calls, say) doesn't lose whatever it already did —
// runScript.ts accumulates these into a ScriptRunResult as they arrive, so
// even a forced-timeout termination resolves with everything up to that
// point instead of an empty result.
export type ScriptWorkerMessage =
  | { type: "log"; line: string }
  | { type: "environmentSet"; key: string; value: string }
  | { type: "headerSet"; key: string; value: string }
  | { type: "bodySet"; value: string }
  | { type: "done"; ok: boolean; error: string | null };
