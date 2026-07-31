import { type KeyValuePair, ensureTrailingBlankRow, stripEmptyRows } from "@/lib/keyValue";
import type { HttpResponse } from "@/lib/http";
import type { VariableLookup } from "@/lib/variables/context";
import { VARIABLE_PATTERN } from "@/lib/variables/tokenizer";
import { substituteVariables } from "@/lib/variables/resolver";
import type { ScriptHalf, ScriptRunResult } from "@/lib/scripting/types";

export type SubTab = "params" | "headers" | "body" | "scripts";

export const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "scripts", label: "Scripts" },
];

export interface LastScriptRun {
  pre: ScriptRunResult | null;
  post: ScriptRunResult | null;
}

export function createEmptyScriptRun(): LastScriptRun {
  return { pre: null, post: null };
}

// The Scripts tab's own internal switcher has one more option than
// `ScriptHalf` (which only names the two *execution* kinds) — a third
// "logs" view with no script text of its own, just this tab's last run
// results for both halves at once.
export type ScriptsSubTab = ScriptHalf | "logs";

export interface RequestTab {
  id: string;
  name: string;
  method: string;
  url: string;
  activeSubTab: SubTab;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: string;
  preRequestScript: string;
  postResponseScript: string;
  activeScriptTab: ScriptsSubTab;
  // Output of the last time this tab's scripts ran (console logs/errors) —
  // never persisted, same as response/error/isSending below: it describes
  // the last send, not saved request state.
  lastScriptRun: LastScriptRun;
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
    preRequestScript: "",
    postResponseScript: "",
    activeScriptTab: "pre-request",
    lastScriptRun: createEmptyScriptRun(),
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
  preRequestScript: string;
  postResponseScript: string;
  activeScriptTab: ScriptsSubTab;
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
  const {
    id,
    name,
    method,
    url,
    activeSubTab,
    params,
    headers,
    body,
    preRequestScript,
    postResponseScript,
    activeScriptTab,
    sourceRequestId,
    sourceCollectionId,
  } = tab;
  return {
    id,
    name,
    method,
    url,
    activeSubTab,
    params: stripEmptyRows(params),
    headers: stripEmptyRows(headers),
    body,
    preRequestScript,
    postResponseScript,
    activeScriptTab,
    sourceRequestId,
    sourceCollectionId,
  };
}

export function fromPersistedTab(saved: PersistedTab): RequestTab {
  return {
    ...saved,
    params: ensureTrailingBlankRow(saved.params),
    headers: ensureTrailingBlankRow(saved.headers),
    lastScriptRun: createEmptyScriptRun(),
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

export function statusVariant(status: number): "success" | "secondary" | "destructive" {
  if (status < 300) return "success";
  if (status < 400) return "secondary";
  return "destructive";
}

export function getUrlError(url: string, context: VariableLookup): string | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;
  const substituted = substituteVariables(trimmed, context);

  // A template URL (e.g. {{baseUrl}}/path, or even just http://{{host}}/path)
  // may still contain an unresolved {{var}} if no environment is active or
  // the variable isn't defined there — `new URL()` throws on the literal
  // `{`/`}` characters even though the URL is perfectly valid once resolved.
  // Fall back to a plain prefix check instead of full parsing in that case.
  // (Variable names aren't limited to \w — see tokenizer.ts's
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

export function getBodyError(body: string, context: VariableLookup): string | null {
  if (body.trim() === "") return null;
  // Resolve whatever the current context can (so e.g. {{port}} used
  // unquoted for a numeric value validates correctly once it substitutes to
  // real digits), then treat anything still unresolved — no active
  // environment, or the variable isn't defined there — as an opaque
  // placeholder for validation purposes only. Postman itself doesn't block
  // editing/sending over a {{var}} that hasn't resolved yet; it'll either
  // resolve by send time or the server will complain, not the editor.
  const withPlaceholders = substituteVariables(stripJsonComments(body), context).replace(
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
