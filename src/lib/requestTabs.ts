import { type KeyValuePair, ensureTrailingBlankRow, stripEmptyRows } from "@/lib/keyValue";
import { type Environment, VARIABLE_PATTERN, substituteVariables } from "@/lib/environments";
import { DEFAULT_HEADERS, type HttpResponse } from "@/lib/http";
import { buildRequestUrl } from "@/lib/requestUrl";

export type SubTab = "params" | "headers" | "body";

export const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
];

export interface RequestTab {
  id: string;
  name: string;
  method: string;
  url: string;
  activeSubTab: SubTab;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: string;
  response: HttpResponse | null;
  error: string | null;
  isSending: boolean;
  // Set when this tab was opened from (or last saved to) a request node in a
  // Collection — lets "Save" update that node in place instead of always
  // opening a "Save to..." picker. Both null for a tab that was never linked
  // to a collection.
  sourceRequestId: string | null;
  sourceCollectionId: string | null;
}

export function createRequestTab(): RequestTab {
  return {
    id: crypto.randomUUID(),
    name: "Untitled request",
    method: "GET",
    url: "",
    activeSubTab: "params",
    params: [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }],
    headers: [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }],
    body: "",
    response: null,
    error: null,
    isSending: false,
    sourceRequestId: null,
    sourceCollectionId: null,
  };
}

// The on-disk shape: everything in RequestTab except the transient,
// never-persisted fields (response, error, isSending).
export interface PersistedTab {
  id: string;
  name: string;
  method: string;
  url: string;
  activeSubTab: SubTab;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: string;
  sourceRequestId: string | null;
  sourceCollectionId: string | null;
}

// tabs.json's top-level shape: which tab was last active is stored once here
// (not per-tab), alongside the tab list itself.
export interface PersistedTabsFile {
  activeTabId: string | null;
  tabs: PersistedTab[];
}

export function toPersistedTab(tab: RequestTab): PersistedTab {
  const { id, name, method, url, activeSubTab, params, headers, body, sourceRequestId, sourceCollectionId } = tab;
  return {
    id,
    name,
    method,
    url,
    activeSubTab,
    params: stripEmptyRows(params),
    headers: stripEmptyRows(headers),
    body,
    sourceRequestId,
    sourceCollectionId,
  };
}

export function fromPersistedTab(saved: PersistedTab): RequestTab {
  return {
    ...saved,
    params: ensureTrailingBlankRow(saved.params),
    headers: ensureTrailingBlankRow(saved.headers),
    response: null,
    error: null,
    isSending: false,
  };
}

export function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

export function statusVariant(status: number): "default" | "secondary" | "destructive" {
  if (status < 300) return "default";
  if (status < 400) return "secondary";
  return "destructive";
}

export function getUrlError(url: string, environment: Environment | null): string | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;
  const substituted = substituteVariables(trimmed, environment);

  // A template URL (e.g. {{baseUrl}}/path, or even just http://{{host}}/path)
  // may still contain an unresolved {{var}} if no environment is active or
  // the variable isn't defined there — `new URL()` throws on the literal
  // `{`/`}` characters even though the URL is perfectly valid once resolved.
  // Fall back to a plain prefix check instead of full parsing in that case.
  // (Variable names aren't limited to \w — see environments.ts's
  // VARIABLE_PATTERN; matched here without the `g` flag since this is a
  // one-shot `.test()`, not an iteration.)
  if (/\{\{\s*[\w.-]+\s*\}\}/.test(substituted)) {
    return /^https?:\/\//i.test(substituted) ? null : "URL must start with http:// or https://";
  }

  let parsed: URL;
  try {
    parsed = new URL(substituted);
  } catch {
    return "Enter a full URL, e.g. https://example.com";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }
  return null;
}

// Strips Postman-style `//` and `/* */` comments from a JSON body before
// parsing/sending — plain JSON doesn't allow comments, but Postman's own raw
// body editor tolerates them for documentation, so requests built elsewhere
// (or just typed by hand, matching Postman muscle memory) shouldn't break
// here. String-aware so a "//" or "/*" inside an actual string value (e.g. a
// URL) is left alone rather than treated as the start of a comment.
export function stripJsonComments(text: string): string {
  let result = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inString) {
      result += ch;
      if (ch === "\\") {
        // Copy the escaped character verbatim (e.g. \" or \\) so it isn't
        // mistaken for the string's closing quote.
        result += next ?? "";
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      i++;
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      i++;
      while (i + 1 < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }

    result += ch;
  }
  return result;
}

export function getBodyError(body: string, environment: Environment | null): string | null {
  if (body.trim() === "") return null;
  // Resolve whatever the active environment can (so e.g. {{port}} used
  // unquoted for a numeric value validates correctly once it substitutes to
  // real digits), then treat anything still unresolved — no active
  // environment, or the variable isn't defined there — as an opaque
  // placeholder for validation purposes only. Postman itself doesn't block
  // editing/sending over a {{var}} that hasn't resolved yet; it'll either
  // resolve by send time or the server will complain, not the editor.
  const withPlaceholders = substituteVariables(stripJsonComments(body), environment).replace(
    VARIABLE_PATTERN,
    "null"
  );
  try {
    JSON.parse(withPlaceholders);
    return null;
  } catch {
    return "Body is not valid JSON";
  }
}

export interface OutgoingRequest {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
}

// Everything actually sent over the wire for `request` — variables
// substituted, params merged into the URL's query string, and the same
// default-header rules (Content-Type if there's a body and none was set,
// User-Agent if none was set) applied. Factored out of handleSend so the
// "Variables in request" panel's cURL preview shows exactly what would go
// out, rather than a second computation that could quietly drift from it.
export function buildOutgoingRequest(request: RequestTab, environment: Environment | null): OutgoingRequest {
  const { method, url, params, headers, body } = request;

  let requestUrl: string;
  try {
    requestUrl = buildRequestUrl(
      substituteVariables(url, environment),
      params.map((p) => ({ ...p, value: substituteVariables(p.value, environment) }))
    );
  } catch {
    // Not a valid absolute URL yet (mid-edit, or a template that hasn't
    // resolved) — fall back to the substituted raw string so the preview
    // still shows something close, instead of throwing during a render.
    requestUrl = substituteVariables(url, environment);
  }

  const requestHeaders = headers
    .filter(({ key, enabled }) => enabled && key.trim() !== "")
    .map(({ key, value }) => [key, substituteVariables(value, environment)] as [string, string]);

  const substitutedBody = substituteVariables(stripJsonComments(body), environment);
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
