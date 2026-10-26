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

// One message per side effect, sent as it happens, so a script that later
// hangs and gets terminated keeps everything it did before that.
export type ScriptWorkerMessage =
  | { type: "log"; line: string }
  | { type: "environmentSet"; key: string; value: string }
  | { type: "headerSet"; key: string; value: string }
  | { type: "bodySet"; value: string }
  | { type: "done"; ok: boolean; error: string | null };
