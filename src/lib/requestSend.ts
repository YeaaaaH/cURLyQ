import { invoke } from "@tauri-apps/api/core";
import type { KeyValuePair } from "@/lib/keyValue";
import type { VariableLookup } from "@/lib/variables/context";
import type { Environment } from "@/lib/environments";
import type { HttpResponse } from "@/lib/http";
import { resolveRequest } from "@/lib/variables/requestResolver";
import { runPostResponseScript, runPreRequestScript } from "@/lib/scripting/runScript";
import { type LastScriptRun, createEmptyScriptRun } from "@/lib/requestTabs";

// Flattens the active environment's enabled, non-empty-key variables into the
// plain Record a script sandbox worker can receive via postMessage (a
// VariableLookup's `.lookup()` closure can't cross that boundary). Exported
// so a caller that needs to layer extra values on top (e.g. a collection
// run's accumulated cross-step variables) can spread over the result rather
// than reimplementing this flattening.
export function environmentToRecord(environment: Environment | null): Record<string, string> {
  const record: Record<string, string> = {};
  if (!environment) return record;
  for (const v of environment.variables) {
    if (v.enabled && v.key.trim() !== "") record[v.key] = v.value;
  }
  return record;
}

function headersToRecord(headers: KeyValuePair[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const h of headers) {
    if (h.enabled && h.key.trim() !== "") record[h.key] = h.value;
  }
  return record;
}

// Applies a pre-request script's `ctx.request.headers.set` calls onto a
// header row list: updates a matching key in place, appends a new row for an
// unseen one. Only ever affects the copy used for this one send.
function applyHeaderPatch(headers: KeyValuePair[], patch: Record<string, string>): KeyValuePair[] {
  let result = headers;
  for (const [key, value] of Object.entries(patch)) {
    const index = result.findIndex((h) => h.key === key);
    result =
      index !== -1
        ? result.map((h, i) => (i === index ? { ...h, value, enabled: true } : h))
        : [...result, { id: crypto.randomUUID(), key, value, enabled: true }];
  }
  return result;
}

// A pre-request script's ctx.environment.set calls apply to the *stored*
// environment asynchronously (a React state update), which wouldn't be
// reflected in the caller's `variableContext` until the next render — too
// late for this same send. Layering the patch in front of the existing
// lookup gives `resolveRequest` an immediately up-to-date view without
// waiting on that re-render. Exported for the same reason as
// `environmentToRecord` above — a collection run needs the same trick
// across steps, not just within one.
export function withEnvironmentPatch(base: VariableLookup, patch: Record<string, string>): VariableLookup {
  if (Object.keys(patch).length === 0) return base;
  return {
    lookup(name) {
      return name in patch ? patch[name] : base.lookup(name);
    },
  };
}

export interface SendableRequest {
  method: string;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: string;
  preRequestScript: string;
  postResponseScript: string;
}

export interface SendResult {
  response: HttpResponse | null;
  error: string | null;
  scriptRun: LastScriptRun;
}

// Progress hooks so a live request tab can update its UI as each stage
// completes (response shown as soon as it arrives, not held back until the
// post-response script also finishes) — callers that don't need intermediate
// state (e.g. a headless collection run) can just await the final
// `SendResult` and ignore these.
export interface SendCallbacks {
  onPreScriptComplete?: (scriptRun: LastScriptRun) => void;
  onResponse?: (response: HttpResponse) => void;
  onPostScriptComplete?: (scriptRun: LastScriptRun) => void;
}

// The full "run pre-script -> resolve variables -> send -> run post-script"
// pipeline for one request, independent of any request tab — used by both a
// live tab's Send button and (headlessly) a collection run. A broken pre/post
// script never blocks the send; it's just recorded in the returned
// `scriptRun`, same treatment either half gets on success.
//
// Takes an already-flattened `environmentRecord` rather than an `Environment`
// object so a collection run can layer earlier steps' `ctx.environment.set()`
// output on top before calling this for a later step — the live active
// environment alone wouldn't reflect those mid-run (see collectionRun.ts).
export async function sendRequestWithScripts(
  request: SendableRequest,
  variableContext: VariableLookup,
  environmentRecord: Record<string, string>,
  applyEnvironmentPatch: (patch: Record<string, string>) => void,
  callbacks: SendCallbacks = {}
): Promise<SendResult> {
  let scriptRun = createEmptyScriptRun();
  let requestForSend: SendableRequest = request;
  let effectiveContext = variableContext;

  if (request.preRequestScript.trim() !== "") {
    const preResult = await runPreRequestScript(
      request.preRequestScript,
      { headers: headersToRecord(request.headers), body: request.body },
      environmentRecord
    );
    scriptRun = { ...scriptRun, pre: preResult };
    callbacks.onPreScriptComplete?.(scriptRun);

    if (Object.keys(preResult.environmentPatch).length > 0) applyEnvironmentPatch(preResult.environmentPatch);
    effectiveContext = withEnvironmentPatch(variableContext, preResult.environmentPatch);

    if (preResult.requestPatch) {
      requestForSend = {
        ...request,
        headers: preResult.requestPatch.headers
          ? applyHeaderPatch(request.headers, preResult.requestPatch.headers)
          : request.headers,
        body: preResult.requestPatch.body ?? request.body,
      };
    }
  }

  const { method, url, headers, body } = resolveRequest(requestForSend, effectiveContext);

  try {
    const response = await invoke<HttpResponse>("send_request", { method, url, headers, body });
    callbacks.onResponse?.(response);

    if (request.postResponseScript.trim() !== "") {
      const postResult = await runPostResponseScript(
        request.postResponseScript,
        { status: response.status, headers: Object.fromEntries(response.headers), body: response.body },
        environmentRecord
      );
      scriptRun = { ...scriptRun, post: postResult };
      callbacks.onPostScriptComplete?.(scriptRun);
      if (Object.keys(postResult.environmentPatch).length > 0) applyEnvironmentPatch(postResult.environmentPatch);
    }

    return { response, error: null, scriptRun };
  } catch (err) {
    return { response: null, error: String(err), scriptRun };
  }
}
