import { invoke } from "@tauri-apps/api/core";
import type { KeyValuePair } from "@/lib/keyValue";
import type { VariableLookup } from "@/lib/variables/context";
import type { Environment } from "@/lib/environments";
import type { HttpResponse } from "@/lib/http";
import { resolveRequest } from "@/lib/variables/requestResolver";
import { runPostResponseScript, runPreRequestScript } from "@/lib/scripting/runScript";
import { type LastScriptRun, createEmptyScriptRun } from "@/lib/requestTabs";

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

// The stored environment only updates on the next React render — too late
// for the send that's already in progress.
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

export interface SendCallbacks {
  onPreScriptComplete?: (scriptRun: LastScriptRun) => void;
  onResponse?: (response: HttpResponse) => void;
  onPostScriptComplete?: (scriptRun: LastScriptRun) => void;
}

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
  let postEnvironmentRecord = environmentRecord;

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
    postEnvironmentRecord = { ...environmentRecord, ...preResult.environmentPatch };

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
        postEnvironmentRecord
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
