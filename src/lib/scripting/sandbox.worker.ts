import type { ScriptHalf, ScriptWorkerMessage } from "./types";

interface ScriptRunRequest {
  script: string;
  kind: ScriptHalf;
  environment: Record<string, string>;
  request?: { headers: Record<string, string>; body: string };
  response?: { status: number; headers: Record<string, string>; body: string };
}

// Runs inside a dedicated Worker (see runScript.ts) so a runaway script
// (infinite loop) can be killed with `worker.terminate()` from the main
// thread instead of freezing the UI, and so script code never touches the
// app's DOM/React state directly. Cast to `Worker` rather than typed against
// the "webworker" lib, which can't coexist with the "DOM" lib the rest of the
// app already compiles under — the two interfaces are structurally
// identical for the onmessage/postMessage surface used here.
const workerScope = self as unknown as Worker;

function formatArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  // JSON.stringify(undefined) — and of a function/symbol — returns the
  // actual `undefined` value, not the string "undefined", despite its type
  // signature claiming `string`. Left unhandled, that collapses to an empty
  // string once joined below, making `console.log(someUndefinedThing)` look
  // like it logged nothing at all instead of the (unhelpful, but at least
  // visible) "undefined" a real console shows.
  if (arg === undefined) return "undefined";
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

// Environment variables, headers, and body are all meant to be plain
// strings — but a script is dynamic (`new Function`), so nothing at runtime
// actually stops it from calling e.g. `ctx.environment.set(key, 42)` or
// passing some other non-string value. `undefined` specifically is handled
// by each `set` call's own guard below (an unset/no-op, not a stored
// value) — this only coerces values that made it past that guard.
function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : formatArg(value);
}

workerScope.onmessage = (e: MessageEvent<ScriptRunRequest>) => {
  const { script, kind, environment, request, response } = e.data;
  const envView: Record<string, string> = { ...environment };

  // Every side effect is posted the moment it happens, not accumulated here
  // and sent once at the end — see ScriptWorkerMessage's doc comment for why
  // (a hung script downstream of a few successful `.set()` calls shouldn't
  // lose them).
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
      // A plain-data snapshot for inspection (e.g. `console.log` or
      // iterating every variable) — `get`/`set` alone can't answer "what
      // variables exist", and being functions, they vanish under the
      // console's JSON-based formatting anyway.
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

    // Real Postman's `.add`/`.upsert` take a single {key, value} object, not
    // two positional args like `.set` — but nothing stops a script here from
    // calling them the `.set`-style way out of habit (positional args
    // destructured as {key, value} silently produce two `undefined`s, not an
    // error, so it'd otherwise fail quietly). Accepting both shapes costs
    // nothing: only the exported *text* has to match real Postman, not how
    // forgiving our own runtime is about parsing it.
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
      // Real Postman has no `ctx`-style `.set(value)` either — the idiomatic
      // forms are direct assignment (`pm.request.body.raw = "..."`) or
      // `.update({ mode, raw, options })`. `.get`/`.set` stay as cURLyQ's own
      // convenience methods; `raw` (a getter/setter, not a plain field) and
      // `update` are additive aliases of the same underlying write so a
      // script using either style behaves identically here.
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
      // Real Postman's numeric status code is `.code`; `.status` there is
      // the string reason phrase ("OK"), which cURLyQ doesn't have (the
      // backend only forwards the numeric code) — `.status` keeps its
      // existing numeric meaning for cURLyQ-native scripts, `.code` is the
      // Postman-shaped alias carrying the same number.
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
    // `pm` is a literal alias for `ctx`, not a separate implementation — a
    // script can use either prefix and get identical behavior, since both
    // names point at the same object. This only covers what `ctx` already
    // implements; scripts relying on Postman-only surface (pm.test,
    // pm.expect, pm.sendRequest, pm.variables) still fail, same as before.
    const run = new Function("ctx", "pm", "console", script);
    run(ctx, ctx, sandboxConsole);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  post({ type: "done", ok: error === null, error });
};
