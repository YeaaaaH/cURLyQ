import { type KeyValuePair, ensureTrailingBlankRow, stripEmptyRows } from "@/lib/keyValue";
import type { HttpResponse } from "@/lib/http";
import type { VariableLookup } from "@/lib/variables/context";
import { VARIABLE_PATTERN } from "@/lib/variables/tokenizer";
import { substituteVariables } from "@/lib/variables/resolver";
import type { ScriptHalf, ScriptRunResult } from "@/lib/scripting/types";
import { type Collection, findCollectionNode } from "@/lib/collections";

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

export type ScriptsSubTab = ScriptHalf | "logs";

export interface RequestTab {
  type: "request";
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
  // Not persisted, like response/error/isSending.
  lastScriptRun: LastScriptRun;
  response: HttpResponse | null;
  error: string | null;
  isSending: boolean;
  // Null when the tab was never linked to a collection request.
  sourceRequestId: string | null;
  sourceCollectionId: string | null;
}

export function createRequestTab(): RequestTab {
  return {
    type: "request",
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
    type: "request",
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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getUrlError(url: string, context: VariableLookup): string | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;
  const substituted = substituteVariables(trimmed, context);

  // new URL() throws on an unresolved {{var}}, so fall back to a prefix check.
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

// String-aware: a // or /* inside a string value (e.g. a URL) is kept.
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
  const withoutComments = stripJsonComments(body);
  // Checked after stripping, so a fully commented-out body counts as empty.
  if (withoutComments.trim() === "") return null;
  // Unresolved {{vars}} become `null` so they don't fail JSON validation.
  const withPlaceholders = substituteVariables(withoutComments, context).replace(VARIABLE_PATTERN, "null");
  try {
    JSON.parse(withPlaceholders);
    return null;
  } catch {
    return "Body is not valid JSON";
  }
}

function sameRows(a: KeyValuePair[], b: KeyValuePair[]): boolean {
  const strippedA = stripEmptyRows(a);
  const strippedB = stripEmptyRows(b);
  if (strippedA.length !== strippedB.length) return false;
  return strippedA.every(
    (row, i) => row.key === strippedB[i].key && row.value === strippedB[i].value && row.enabled === strippedB[i].enabled
  );
}

// A tab with no linked (or a deleted) saved request is compared against a blank one.
export function isRequestTabDirty(tab: RequestTab, collections: Collection[]): boolean {
  const savedNode =
    tab.sourceCollectionId && tab.sourceRequestId
      ? findCollectionNode(collections, tab.sourceCollectionId, tab.sourceRequestId)
      : null;
  const baseline =
    savedNode && savedNode.type === "request"
      ? savedNode
      : { url: "", params: [] as KeyValuePair[], headers: [] as KeyValuePair[], body: "", preRequestScript: "", postResponseScript: "" };

  return (
    tab.url !== baseline.url ||
    tab.body !== baseline.body ||
    tab.preRequestScript !== baseline.preRequestScript ||
    tab.postResponseScript !== baseline.postResponseScript ||
    !sameRows(tab.params, baseline.params) ||
    !sameRows(tab.headers, baseline.headers)
  );
}
