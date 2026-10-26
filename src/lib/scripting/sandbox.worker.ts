import type { ScriptHalf, ScriptWorkerMessage } from "./types";

interface ScriptRunRequest {
  script: string;
  kind: ScriptHalf;
  environment: Record<string, string>;
  request?: { headers: Record<string, string>; body: string };
  response?: { status: number; headers: Record<string, string>; body: string };
}

// The "webworker" TS lib can't coexist with "DOM"; `Worker` has the same
// onmessage/postMessage surface.
const workerScope = self as unknown as Worker;

function formatArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  // JSON.stringify(undefined) returns undefined (not "undefined"), which
  // would join into an empty log line.
  if (arg === undefined) return "undefined";
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : formatArg(value);
}

workerScope.onmessage = (e: MessageEvent<ScriptRunRequest>) => {
  const { script, kind, environment, request, response } = e.data;
  const envView: Record<string, string> = { ...environment };

  function post(message: ScriptWorkerMessage) {
    workerScope.postMessage(message);
  }

  const ctx: Record<string, unknown> = {
    environment: {
      get: (key: string) => envView[key],
      set: (key: string, value: string) => {
        if (value === undefined) {
          post({ type: "log", line: `[warn] ctx.environment.set("${key}", undefined) ignored — no value to set.` });
          return;
        }
        const stringValue = toStringValue(value);
        envView[key] = stringValue;
        post({ type: "environmentSet", key, value: stringValue });
      },
      toObject: () => ({ ...envView }),
    },
  };

  if (kind === "pre-request" && request) {
    const headersView: Record<string, string> = { ...request.headers };
    let bodyView = request.body;

    function setHeader(key: string, value: string) {
      if (value === undefined) {
        post({ type: "log", line: `[warn] ctx.request.headers.set("${key}", undefined) ignored — no value to set.` });
        return;
      }
      const stringValue = toStringValue(value);
      headersView[key] = stringValue;
      post({ type: "headerSet", key, value: stringValue });
    }

    function setBody(value: string) {
      if (value === undefined) {
        post({ type: "log", line: "[warn] ctx.request.body.set(undefined) ignored — no value to set." });
        return;
      }
      const stringValue = toStringValue(value);
      bodyView = stringValue;
      post({ type: "bodySet", value: stringValue });
    }

    // Postman's `.add`/`.upsert` take `{key, value}`; positional `(key, value)`
    // is accepted too, since destructuring it would silently yield undefineds.
    function resolveHeaderArgs(a: unknown, b: unknown): { key: string; value: string } | null {
      if (typeof a === "string") return { key: a, value: b as string };
      if (a && typeof a === "object" && "key" in a) {
        const obj = a as { key: string; value: string };
        return { key: obj.key, value: obj.value };
      }
      return null;
    }

    ctx.request = {
      headers: {
        get: (key: string) => headersView[key],
        set: setHeader,
        add: (a: unknown, b?: unknown) => {
          const resolved = resolveHeaderArgs(a, b);
          if (resolved) setHeader(resolved.key, resolved.value);
        },
        upsert: (a: unknown, b?: unknown) => {
          const resolved = resolveHeaderArgs(a, b);
          if (resolved) setHeader(resolved.key, resolved.value);
        },
      },
      // `raw` and `update` are Postman's forms; `get`/`set` are cURLyQ's.
      body: {
        get: () => bodyView,
        set: setBody,
        get raw() {
          return bodyView;
        },
        set raw(value: string) {
          setBody(value);
        },
        update: (next: unknown) => {
          const raw = typeof next === "string" ? next : (next as { raw?: unknown } | null)?.raw;
          if (typeof raw === "string") setBody(raw);
        },
      },
    };
  }

  if (kind === "post-response" && response) {
    ctx.response = {
      status: response.status,
      // Postman's numeric code; its `.status` is the reason phrase, which
      // cURLyQ doesn't receive.
      code: response.status,
      headers: { ...response.headers },
      body: response.body,
      json: () => JSON.parse(response.body),
    };
  }

  const sandboxConsole = {
    log: (...args: unknown[]) => post({ type: "log", line: args.map(formatArg).join(" ") }),
    warn: (...args: unknown[]) => post({ type: "log", line: `[warn] ${args.map(formatArg).join(" ")}` }),
    error: (...args: unknown[]) => post({ type: "log", line: `[error] ${args.map(formatArg).join(" ")}` }),
  };

  let error: string | null = null;
  try {
    const run = new Function("ctx", "pm", "console", script);
    run(ctx, ctx, sandboxConsole);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  post({ type: "done", ok: error === null, error });
};
