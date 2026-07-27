import type { VariableLookup } from "@/lib/variables/context";
import { substituteVariables } from "@/lib/variables/resolver";
import { DEFAULT_HEADERS } from "@/lib/http";
import { buildRequestUrl } from "@/lib/requestUrl";
import { stripJsonComments, type RequestTab } from "@/lib/requestTabs";

export interface OutgoingRequest {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
}

// Everything actually sent over the wire for `request` — variables
// substituted, params merged into the URL's query string, and the same
// default-header rules (Content-Type if there's a body and none was set,
// User-Agent if none was set) applied. Factored out so the "Variables in
// request" panel's cURL preview shows exactly what would go out, rather than
// a second computation that could quietly drift from it.
export function resolveRequest(request: RequestTab, context: VariableLookup): OutgoingRequest {
  const { method, url, params, headers, body } = request;

  let requestUrl: string;
  try {
    requestUrl = buildRequestUrl(
      substituteVariables(url, context),
      params.map((p) => ({ ...p, value: substituteVariables(p.value, context) }))
    );
  } catch {
    // Not a valid absolute URL yet (mid-edit, or a template that hasn't
    // resolved) — fall back to the substituted raw string so the preview
    // still shows something close, instead of throwing during a render.
    requestUrl = substituteVariables(url, context);
  }

  const requestHeaders = headers
    .filter(({ key, enabled }) => enabled && key.trim() !== "")
    .map(({ key, value }) => [key, substituteVariables(value, context)] as [string, string]);

  const substitutedBody = substituteVariables(stripJsonComments(body), context);
  const trimmedBody = substitutedBody.trim();
  const hasContentType = requestHeaders.some(([key]) => key.toLowerCase() === "content-type");
  if (trimmedBody !== "" && !hasContentType) {
    requestHeaders.push(["Content-Type", "application/json"]);
  }
  for (const { key, value } of DEFAULT_HEADERS) {
    if (!requestHeaders.some(([k]) => k.toLowerCase() === key.toLowerCase())) {
      requestHeaders.push([key, value]);
    }
  }

  return { method, url: requestUrl, headers: requestHeaders, body: trimmedBody === "" ? null : substitutedBody };
}
