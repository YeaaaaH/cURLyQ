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

// Also used by the cURL preview, so the preview is exactly what gets sent.
export function resolveRequest(
  request: Pick<RequestTab, "method" | "url" | "params" | "headers" | "body">,
  context: VariableLookup
): OutgoingRequest {
  const { method, url, params, headers, body } = request;

  let requestUrl: string;
  try {
    requestUrl = buildRequestUrl(
      substituteVariables(url, context),
      params.map((p) => ({ ...p, value: substituteVariables(p.value, context) }))
    );
  } catch {
    // Not a valid URL yet (mid-edit or unresolved template) — don't throw during render.
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
