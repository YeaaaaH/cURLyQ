import { type KeyValuePair, ensureTrailingBlankRow, stripEmptyRows } from "@/lib/keyValue";
import { type Environment, substituteVariables } from "@/lib/environments";
import type { HttpResponse } from "@/lib/http";

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
}

// tabs.json's top-level shape: which tab was last active is stored once here
// (not per-tab), alongside the tab list itself.
export interface PersistedTabsFile {
  activeTabId: string | null;
  tabs: PersistedTab[];
}

export function toPersistedTab(tab: RequestTab): PersistedTab {
  const { id, name, method, url, activeSubTab, params, headers, body } = tab;
  return {
    id,
    name,
    method,
    url,
    activeSubTab,
    params: stripEmptyRows(params),
    headers: stripEmptyRows(headers),
    body,
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
  let parsed: URL;
  try {
    parsed = new URL(substituteVariables(trimmed, environment));
  } catch {
    return "Enter a full URL, e.g. https://example.com";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }
  return null;
}

export function getBodyError(body: string): string | null {
  if (body.trim() === "") return null;
  try {
    JSON.parse(body);
    return null;
  } catch {
    return "Body is not valid JSON";
  }
}
