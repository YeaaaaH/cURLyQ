import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Globe, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-600",
  POST: "text-amber-600",
  PUT: "text-blue-600",
  PATCH: "text-purple-600",
  DELETE: "text-destructive",
};

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

type SubTab = "params" | "headers" | "body";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
];

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
}

function createEnvironment(name: string): Environment {
  return {
    id: crypto.randomUUID(),
    name,
    variables: [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }],
  };
}

// New environments are named after world capitals rather than "Environment
// N" — picking the first one not already in use also sidesteps the old
// collision bug where a count-based number (existing.length + 1) drifted out
// of sync once something in the middle of the list got deleted.
const CAPITAL_NAMES = [
  "Amsterdam", "Ankara", "Athens", "Baghdad", "Bangkok", "Beijing", "Berlin", "Bogota",
  "Brasilia", "Brussels", "Bucharest", "Budapest", "Buenos Aires", "Cairo", "Canberra",
  "Copenhagen", "Dakar", "Damascus", "Dhaka", "Dublin", "Hanoi", "Havana", "Helsinki",
  "Islamabad", "Jakarta", "Kyiv", "Lima", "Lisbon", "London", "Madrid", "Manila",
  "Mexico City", "Vilnius", "Nairobi", "New Delhi", "Oslo", "Ottawa", "Paris", "Prague",
  "Quito", "Riga", "Riyadh", "Rome", "Santiago", "Seoul", "Singapore", "Sofia",
  "Stockholm", "Tallinn", "Tokyo", "Vienna", "Warsaw", "Wellington", "Zagreb",
];

function nextEnvironmentName(existing: Environment[]): string {
  const usedNames = new Set(existing.map((e) => e.name));
  const capital = CAPITAL_NAMES.find((name) => !usedNames.has(name));
  if (capital) return capital;
  // Every capital in the list is already taken — cycle through the list
  // again with an incrementing suffix ("London 2", "Paris 2", ...) rather
  // than switching to a differently-themed fallback name.
  for (let iteration = 2; ; iteration++) {
    const capitalForIteration = CAPITAL_NAMES.find(
      (name) => !usedNames.has(`${name} ${iteration}`)
    );
    if (capitalForIteration) return `${capitalForIteration} ${iteration}`;
  }
}

interface RequestTab {
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

function createRequestTab(): RequestTab {
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
interface PersistedTab {
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
interface PersistedTabsFile {
  activeTabId: string | null;
  tabs: PersistedTab[];
}

function toPersistedTab(tab: RequestTab): PersistedTab {
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

function fromPersistedTab(saved: PersistedTab): RequestTab {
  return {
    ...saved,
    params: ensureTrailingBlankRow(saved.params),
    headers: ensureTrailingBlankRow(saved.headers),
    response: null,
    error: null,
    isSending: false,
  };
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function statusVariant(status: number): "default" | "secondary" | "destructive" {
  if (status < 300) return "default";
  if (status < 400) return "secondary";
  return "destructive";
}

// Replaces {{varName}} with the matching enabled variable's value from the
// active environment. Unresolved placeholders (no active environment, or no
// matching enabled variable) are left as-is — substitution only ever happens
// on a copy used for validation/sending, never written back into state, so
// the raw {{varName}} stays visible and editable in the UI.
function substituteVariables(text: string, environment: Environment | null): string {
  if (!environment) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (placeholder, name) => {
    const variable = environment.variables.find((v) => v.enabled && v.key === name);
    return variable ? variable.value : placeholder;
  });
}

function findVariableNames(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
}

// Scans the given texts for {{varName}} placeholders that wouldn't resolve
// against the active environment, for a non-blocking UI hint.
function getUnresolvedVariables(texts: string[], environment: Environment | null): string[] {
  const resolvedKeys = new Set(
    (environment?.variables ?? [])
      .filter((v) => v.enabled && v.key.trim() !== "")
      .map((v) => v.key)
  );
  const unresolved = new Set<string>();
  for (const text of texts) {
    for (const name of findVariableNames(text)) {
      if (!resolvedKeys.has(name)) unresolved.add(name);
    }
  }
  return [...unresolved];
}

function getUrlError(url: string, environment: Environment | null): string | null {
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

function getBodyError(body: string): string | null {
  if (body.trim() === "") return null;
  try {
    JSON.parse(body);
    return null;
  } catch {
    return "Body is not valid JSON";
  }
}

function buildRequestUrl(rawUrl: string, params: KeyValuePair[]): string {
  const url = new URL(rawUrl);
  url.search = "";
  for (const { key, value, enabled } of params) {
    if (!enabled || key.trim() === "") continue;
    url.searchParams.append(key, value);
  }
  return url.toString();
}

// Only escapes characters that would otherwise break the query string's
// structure (&, =, #) — everything else, including non-ASCII text, is left
// readable. url.toString() would percent-encode all of it, which is correct
// for the wire format but unreadable while editing.
function escapeForDisplay(value: string): string {
  return value.replace(/[&=#]/g, (ch) => encodeURIComponent(ch));
}

// Plain string splicing rather than the URL API, so this also works for
// template URLs like {{baseUrl}}/path that aren't parseable as absolute URLs.
function buildDisplayUrl(rawUrl: string, params: KeyValuePair[]): string {
  const hashIndex = rawUrl.indexOf("#");
  const hash = hashIndex === -1 ? "" : rawUrl.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = params
    .filter(({ key, enabled }) => enabled && key.trim() !== "")
    .map(({ key, value }) => `${escapeForDisplay(key)}=${escapeForDisplay(value)}`)
    .join("&");
  return `${base}${query ? `?${query}` : ""}${hash}`;
}

function syncUrlWithParams(rawUrl: string, params: KeyValuePair[]): string {
  return buildDisplayUrl(rawUrl, params);
}

function unescapeFromDisplay(value: string): string {
  return value.replace(/%23|%26|%3d/gi, (seq) => decodeURIComponent(seq));
}

// Reverse of buildDisplayUrl — also plain string splicing rather than the URL
// API, so typing/pasting a template URL like {{baseUrl}}/path?x=1 (which
// isn't parseable as an absolute URL) still keeps the Params tab in sync.
function parseParamsFromUrl(rawUrl: string): KeyValuePair[] {
  const hashIndex = rawUrl.indexOf("#");
  const withoutHash = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex === -1) return [];
  const query = withoutHash.slice(queryIndex + 1);
  if (query === "") return [];
  return query
    .split("&")
    .map((pair) => {
      const eqIndex = pair.indexOf("=");
      const key = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
      const value = eqIndex === -1 ? "" : pair.slice(eqIndex + 1);
      return {
        id: crypto.randomUUID(),
        key: unescapeFromDisplay(key),
        value: unescapeFromDisplay(value),
        enabled: true,
      };
    })
    .filter(({ key, value }) => key !== "" || value !== "");
}

// Shared self-growing-row logic for Params/Headers: always keeps exactly one
// trailing empty row in state so there's a stable place to type a new entry.
function updateRows(
  rows: KeyValuePair[],
  index: number,
  patch: Partial<KeyValuePair>
): KeyValuePair[] {
  const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
  const last = next[next.length - 1];
  if (last.key.trim() !== "" || last.value.trim() !== "") {
    next.push({ id: crypto.randomUUID(), key: "", value: "", enabled: true });
  }
  return next;
}

function removeRow(rows: KeyValuePair[], index: number): KeyValuePair[] {
  const remaining = rows.filter((_, i) => i !== index);
  return remaining.length > 0
    ? remaining
    : [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }];
}

// The self-growing-row pattern always keeps a blank trailing row in live UI
// state so there's somewhere to type a new entry — but that row shouldn't be
// written to disk until it actually has a key or value.
function stripEmptyRows(rows: KeyValuePair[]): KeyValuePair[] {
  return rows.filter(({ key, value }) => key.trim() !== "" || value.trim() !== "");
}

// Reverse of stripEmptyRows, applied after loading persisted rows — restores
// the invariant the self-growing-row pattern expects (a blank row to type
// into), since a saved row list may have none (fully stripped) or end in a
// filled-in row.
function ensureTrailingBlankRow(rows: KeyValuePair[]): KeyValuePair[] {
  const last = rows[rows.length - 1];
  if (!last || last.key.trim() !== "" || last.value.trim() !== "") {
    return [...rows, { id: crypto.randomUUID(), key: "", value: "", enabled: true }];
  }
  return rows;
}

const KeyValueEditor = memo(function KeyValueEditor({
  rows,
  onUpdate,
  onRemove,
}: {
  rows: KeyValuePair[];
  onUpdate: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="w-4" />
        <span className="flex-1">Key</span>
        <span className="flex-1">Value</span>
        <span className="w-8" />
      </div>
      {rows.map((row, index) => {
        const isTrailingEmpty =
          index === rows.length - 1 && row.key.trim() === "" && row.value.trim() === "";
        return (
          <div key={row.id} className={cn("flex items-center gap-2", !row.enabled && "opacity-50")}>
            <Checkbox
              checked={row.enabled}
              onCheckedChange={(checked) => onUpdate(index, { enabled: checked === true })}
              aria-label={`Include ${row.key} in request`}
              className={isTrailingEmpty ? "invisible" : undefined}
            />
            <Input
              className="font-mono"
              placeholder="key"
              value={row.key}
              onChange={(e) => onUpdate(index, { key: e.target.value })}
            />
            <Input
              className="font-mono"
              placeholder="value"
              value={row.value}
              onChange={(e) => onUpdate(index, { value: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              aria-label="Remove row"
              className={isTrailingEmpty ? "invisible" : undefined}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
});

// Local draft state, only committed to the shared `environments` state on
// explicit confirm (click or Enter) — typing here never touches the
// app-wide state, so it can't cascade a re-render into the sidebar,
// environment dropdown, or the rest of this editor on every keystroke.
// `key={id}` on the call site (not shown here) resets the draft whenever the
// user switches which environment they're editing.
function EnvironmentNameField({
  name,
  onConfirm,
}: {
  name: string;
  onConfirm: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  const isDirty = trimmed !== "" && trimmed !== name;

  function commit() {
    if (isDirty) onConfirm(trimmed);
    else setDraft(name);
  }

  return (
    <div className="flex flex-none items-center gap-1.5">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-auto min-w-32 max-w-full font-medium [field-sizing:content]"
        aria-label="Environment name"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={commit}
        disabled={!isDirty}
        aria-label="Confirm name change"
      >
        <Check className="size-3.5" />
      </Button>
    </div>
  );
}

function EnvironmentEditor({
  environments,
  editingId,
  onSelectEditing,
  onAdd,
  onRename,
  onDelete,
  onUpdateVariable,
  onRemoveVariable,
}: {
  environments: Environment[];
  editingId: string | null;
  onSelectEditing: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onUpdateVariable: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemoveVariable: (index: number) => void;
}) {
  const editing = environments.find((e) => e.id === editingId) ?? null;

  return (
    <div className="flex h-[75vh] gap-4">
      <div className="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-1 pr-3">
        {environments.map((env) => (
          <div
            key={env.id}
            className={cn(
              "group/env-row flex shrink-0 items-center rounded-md",
              env.id === editingId && "bg-secondary"
            )}
          >
            <button
              type="button"
              onClick={() => onSelectEditing(env.id)}
              className={cn(
                "min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm",
                env.id === editingId ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {env.name}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${env.name} options`}
                  className="mr-0.5 shrink-0 text-muted-foreground opacity-0 group-hover/env-row:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(env.id)}>
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="mt-1 shrink-0 justify-start gap-1.5 text-muted-foreground"
        >
          <Plus className="size-3.5" />
          New environment
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-1">
        {editing ? (
          <>
            <EnvironmentNameField
              key={editing.id}
              name={editing.name}
              onConfirm={(name) => onRename(editing.id, name)}
            />
            <KeyValueEditor
              rows={editing.variables}
              onUpdate={onUpdateVariable}
              onRemove={onRemoveVariable}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No environments yet. Create one to define variables like{" "}
            <code className="font-mono">baseUrl</code>.
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  const [requests, setRequests] = useState<RequestTab[]>(() => [createRequestTab()]);
  const [activeId, setActiveId] = useState(() => requests[0].id);

  const activeRequest = requests.find((r) => r.id === activeId)!;

  const [environments, setEnvironments] = useState<Environment[]>([]);
  // Which environment is active is a lightweight UI preference (not shared
  // request data), so it lives in localStorage rather than round-tripping
  // through Rust like the environments themselves.
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(
    () => localStorage.getItem("curlyq-active-environment-id")
  );

  // Restore saved environments, if any, on mount.
  useEffect(() => {
    invoke<Environment[]>("load_environments").then((saved) => {
      if (saved.length > 0) {
        setEnvironments(
          saved.map((e) => ({ ...e, variables: ensureTrailingBlankRow(e.variables) }))
        );
      }
    });
  }, []);

  // Debounced autosave, same pattern as tabs. Strips the always-present blank
  // trailing variable row so environments.json doesn't accumulate an
  // empty-key/empty-value entry per environment.
  useEffect(() => {
    const timeout = setTimeout(() => {
      invoke("save_environments", {
        environments: environments.map((e) => ({ ...e, variables: stripEmptyRows(e.variables) })),
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [environments]);

  useEffect(() => {
    if (activeEnvironmentId === null) {
      localStorage.removeItem("curlyq-active-environment-id");
    } else {
      localStorage.setItem("curlyq-active-environment-id", activeEnvironmentId);
    }
  }, [activeEnvironmentId]);

  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) ?? null;

  // A drag-to-open sidebar (rather than a click toggle) for browsing many
  // environments at once. Matches Postman's feel: a short pull past a small
  // threshold snaps straight to the constant open width (not a continuous
  // pixel-by-pixel resize), and pulling back the other way snaps it shut.
  const [sidebarWidth, setSidebarWidth] = useState(0);

  function handleSidebarHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const wasOpen = sidebarWidth > 0;
    const openWidth = window.innerWidth * 0.16;
    const threshold = 48;
    let toggled = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      if (toggled) return;
      const delta = moveEvent.clientX - startX;
      if (!wasOpen && delta > threshold) {
        setSidebarWidth(openWidth);
        toggled = true;
      } else if (wasOpen && delta < -threshold) {
        setSidebarWidth(0);
        toggled = true;
      }
    }
    function handlePointerUp() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    }
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }

  const [environmentEditorOpen, setEnvironmentEditorOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<string | null>(null);

  function openEnvironmentEditor(id: string) {
    setEditingEnvironmentId(id);
    setEnvironmentEditorOpen(true);
  }

  function handleAddEnvironment() {
    // Name is derived from `prev` inside the updater (not the `environments`
    // closure) so rapid clicks queued before a re-render each still see the
    // true current list instead of a stale one.
    const id = crypto.randomUUID();
    setEnvironments((prev) => [...prev, { ...createEnvironment(nextEnvironmentName(prev)), id }]);
    setEditingEnvironmentId(id);
  }

  function handleRenameEnvironment(id: string, name: string) {
    setEnvironments((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  }

  function handleDeleteEnvironment(id: string) {
    const remaining = environments.filter((e) => e.id !== id);
    setEnvironments(remaining);
    if (activeEnvironmentId === id) setActiveEnvironmentId(null);
    if (editingEnvironmentId === id) setEditingEnvironmentId(remaining[0]?.id ?? null);
  }

  const updateEnvironmentVariable = useCallback(
    (index: number, patch: Partial<KeyValuePair>) => {
      if (editingEnvironmentId === null) return;
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === editingEnvironmentId ? { ...e, variables: updateRows(e.variables, index, patch) } : e
        )
      );
    },
    [editingEnvironmentId]
  );

  const removeEnvironmentVariable = useCallback(
    (index: number) => {
      if (editingEnvironmentId === null) return;
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === editingEnvironmentId ? { ...e, variables: removeRow(e.variables, index) } : e
        )
      );
    },
    [editingEnvironmentId]
  );

  // Restore tabs left open from the previous session, if any were saved,
  // including which tab and which sub-tab were last active.
  useEffect(() => {
    invoke<PersistedTabsFile>("load_tabs").then((saved) => {
      if (saved.tabs.length === 0) return;
      const restored = saved.tabs.map(fromPersistedTab);
      setRequests(restored);
      const savedActiveId = restored.some((r) => r.id === saved.activeTabId)
        ? saved.activeTabId!
        : restored[0].id;
      setActiveId(savedActiveId);
    });
  }, []);

  // Quietly keep disk in sync with whatever's currently open, debounced so a
  // burst of keystrokes doesn't trigger a write per character.
  useEffect(() => {
    const timeout = setTimeout(() => {
      invoke("save_tabs", { activeTabId: activeId, tabs: requests.map(toPersistedTab) });
    }, 500);
    return () => clearTimeout(timeout);
  }, [requests, activeId]);

  function updateActiveRequest(patch: Partial<RequestTab>) {
    setRequests((prev) => prev.map((r) => (r.id === activeId ? { ...r, ...patch } : r)));
  }

  function handleAddTab() {
    const tab = createRequestTab();
    setRequests((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }

  function handleCloseTab(id: string) {
    const closingIndex = requests.findIndex((r) => r.id === id);
    const remaining = requests.filter((r) => r.id !== id);

    if (remaining.length === 0) {
      const fresh = createRequestTab();
      setRequests([fresh]);
      setActiveId(fresh.id);
      return;
    }

    setRequests(remaining);
    if (id === activeId) {
      const newActiveIndex = Math.min(closingIndex, remaining.length - 1);
      setActiveId(remaining[newActiveIndex].id);
    }
  }

  function handleTabsWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaY === 0) return;
    e.currentTarget.scrollLeft += e.deltaY;
  }

  const updateParam = useCallback(
    (index: number, patch: Partial<KeyValuePair>) => {
      setRequests((prev) =>
        prev.map((r) => {
          if (r.id !== activeId) return r;
          const params = updateRows(r.params, index, patch);
          return { ...r, params, url: syncUrlWithParams(r.url, params) };
        })
      );
    },
    [activeId]
  );

  const removeParam = useCallback(
    (index: number) => {
      setRequests((prev) =>
        prev.map((r) => {
          if (r.id !== activeId) return r;
          const params = removeRow(r.params, index);
          return { ...r, params, url: syncUrlWithParams(r.url, params) };
        })
      );
    },
    [activeId]
  );

  const updateHeader = useCallback(
    (index: number, patch: Partial<KeyValuePair>) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === activeId ? { ...r, headers: updateRows(r.headers, index, patch) } : r))
      );
    },
    [activeId]
  );

  const removeHeader = useCallback(
    (index: number) => {
      setRequests((prev) =>
        prev.map((r) => (r.id === activeId ? { ...r, headers: removeRow(r.headers, index) } : r))
      );
    },
    [activeId]
  );

  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    const cursor = selectionStart + 2;
    updateActiveRequest({ body: value.slice(0, selectionStart) + "  " + value.slice(selectionEnd) });
    // Controlled textareas don't preserve cursor position on programmatic value
    // changes, so restore it manually once React commits the new value.
    requestAnimationFrame(() => textarea.setSelectionRange(cursor, cursor));
  }

  function handleUrlChange(rawUrl: string) {
    if (rawUrl.trim() === "") {
      updateActiveRequest({
        url: rawUrl,
        params: [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }],
      });
      return;
    }
    const params = parseParamsFromUrl(rawUrl);
    params.push({ id: crypto.randomUUID(), key: "", value: "", enabled: true });
    updateActiveRequest({ url: rawUrl, params });
  }

  const isUrlEmpty = activeRequest.url.trim() === "";
  const urlError = useMemo(
    () => getUrlError(activeRequest.url, activeEnvironment),
    [activeRequest.url, activeEnvironment]
  );
  const bodyError = useMemo(() => getBodyError(activeRequest.body), [activeRequest.body]);
  const canSend = !isUrlEmpty && !urlError;
  const unresolvedVariables = useMemo(
    () =>
      getUnresolvedVariables(
        [
          activeRequest.url,
          ...activeRequest.params.map((p) => p.value),
          ...activeRequest.headers.map((h) => h.value),
          activeRequest.body,
        ],
        activeEnvironment
      ),
    [activeRequest.url, activeRequest.params, activeRequest.headers, activeRequest.body, activeEnvironment]
  );

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    const { method, url, params, headers, body } = activeRequest;
    const requestUrl = buildRequestUrl(
      substituteVariables(url, activeEnvironment),
      params.map((p) => ({ ...p, value: substituteVariables(p.value, activeEnvironment) }))
    );
    const requestHeaders = headers
      .filter(({ key, enabled }) => enabled && key.trim() !== "")
      .map(({ key, value }) => [key, substituteVariables(value, activeEnvironment)] as [string, string]);

    const substitutedBody = substituteVariables(body, activeEnvironment);
    const trimmedBody = substitutedBody.trim();
    const hasContentType = requestHeaders.some(([key]) => key.toLowerCase() === "content-type");
    if (trimmedBody !== "" && !hasContentType) {
      requestHeaders.push(["Content-Type", "application/json"]);
    }

    updateActiveRequest({ error: null, response: null, isSending: true });
    try {
      const result = await invoke<HttpResponse>("send_request", {
        method,
        url: requestUrl,
        headers: requestHeaders,
        body: trimmedBody === "" ? null : substitutedBody,
      });
      updateActiveRequest({ response: result, isSending: false });
    } catch (err) {
      updateActiveRequest({ error: String(err), isSending: false });
    }
  }

  return (
    <>
      <div
        className="fixed inset-y-0 left-0 z-30 overflow-hidden border-r bg-muted transition-[width] duration-150"
        style={{ width: sidebarWidth }}
      >
        <div className="flex h-full w-[16vw] min-w-[180px] flex-col gap-1 p-3">
          <Collapsible className="flex shrink-0 flex-col">
            <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
              Collections
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-3">
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No collections yet.</p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen className="flex min-h-0 flex-1 flex-col">
            <CollapsibleTrigger className="group flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
              Environments
            </CollapsibleTrigger>
            <CollapsibleContent className="flex min-h-0 flex-1 flex-col gap-1 pl-3">
              <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                {environments.map((env) => (
                  <div
                    key={env.id}
                    className={cn(
                      "group/sidebar-env flex shrink-0 items-center rounded-md",
                      env.id === activeEnvironmentId && "bg-secondary"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveEnvironmentId(env.id)}
                      className={cn(
                        "min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm",
                        env.id === activeEnvironmentId
                          ? "font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {env.name}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEnvironmentEditor(env.id)}
                      aria-label={`Edit ${env.name}`}
                      className="mr-0.5 shrink-0 text-muted-foreground opacity-0 group-hover/sidebar-env:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddEnvironment}
                className="shrink-0 justify-start gap-1.5 text-muted-foreground"
              >
                <Plus className="size-3.5" />
                New environment
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div
        onPointerDown={handleSidebarHandlePointerDown}
        role="separator"
        aria-label="Drag to open the environments sidebar"
        className="fixed inset-y-0 z-40 w-1 cursor-ew-resize touch-none hover:bg-foreground/20"
        style={{ left: sidebarWidth }}
      />

      <main
        className="flex h-screen flex-col gap-5 overflow-hidden p-8 transition-[margin-left] duration-150"
        style={{ marginLeft: sidebarWidth }}
      >
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className="scrollbar-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
            onWheel={handleTabsWheel}
          >
            {requests.map((tab) => (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveId(tab.id);
                }}
                className={cn(
                  "flex shrink-0 cursor-default items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  tab.id === activeId
                    ? "border border-input bg-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("text-xs font-semibold", METHOD_COLORS[tab.method])}>
                  {tab.method}
                </span>
                <span className={tab.id === activeId ? "text-foreground" : undefined}>
                  {tab.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  aria-label={`Close ${tab.name}`}
                  className="rounded p-0.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAddTab}
            aria-label="New request tab"
            className="shrink-0"
          >
            <Plus />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-w-[9rem] shrink-0 gap-1.5 text-muted-foreground"
              >
                <Globe className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate">{activeEnvironment?.name ?? "No environment"}</span>
                <ChevronDown className="size-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              // <main> has a fixed p-8 (2rem) padding and this trigger is the
              // last element in its top row, so the trigger's right edge is
              // always exactly `100vw - 2rem` — no DOM measurement needed to
              // keep the menu's left edge from crossing the window's midpoint.
              className="scrollbar-thin w-64 max-w-[calc(50vw-2rem)] max-h-[min(50vh,var(--radix-dropdown-menu-content-available-height))]"
            >
              <DropdownMenuRadioGroup
                value={activeEnvironmentId ?? ""}
                onValueChange={(value) => setActiveEnvironmentId(value === "" ? null : value)}
              >
                <DropdownMenuRadioItem value="">No environment</DropdownMenuRadioItem>
                {environments.map((env) => (
                  <DropdownMenuRadioItem key={env.id} value={env.id} className="group gap-2">
                    <span className="min-w-0 flex-1 truncate">{env.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEnvironmentEditor(env.id);
                      }}
                      aria-label={`Edit ${env.name}`}
                      className="shrink-0 rounded p-0.5 text-muted-foreground/70 opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 group-data-[highlighted]:opacity-100"
                    >
                      <Pencil className="size-3" />
                    </button>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Dialog open={environmentEditorOpen} onOpenChange={setEnvironmentEditorOpen}>
          <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw]">
            <DialogHeader>
              <DialogTitle>Environments</DialogTitle>
            </DialogHeader>
            <EnvironmentEditor
              environments={environments}
              editingId={editingEnvironmentId}
              onSelectEditing={setEditingEnvironmentId}
              onAdd={handleAddEnvironment}
              onRename={handleRenameEnvironment}
              onDelete={handleDeleteEnvironment}
              onUpdateVariable={updateEnvironmentVariable}
              onRemoveVariable={removeEnvironmentVariable}
            />
          </DialogContent>
        </Dialog>

        <input
          type="text"
          value={activeRequest.name}
          onChange={(e) => updateActiveRequest({ name: e.target.value })}
          onBlur={() => {
            if (activeRequest.name.trim() === "") {
              updateActiveRequest({ name: "Untitled request" });
            }
          }}
          placeholder="Untitled request"
          aria-label="Request name"
          className="-ml-2 w-full rounded-md bg-transparent px-2 py-1 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
        />

        <form className="flex flex-col gap-1.5" onSubmit={handleSend}>
          <div className="flex gap-2">
            <Select
              value={activeRequest.method}
              onValueChange={(method) => updateActiveRequest({ method })}
            >
              <SelectTrigger className="w-28 font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="font-mono aria-invalid:border-destructive"
              type="text"
              value={activeRequest.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com"
              aria-invalid={urlError !== null}
            />
            <Button type="submit" className="w-24" disabled={activeRequest.isSending || !canSend}>
              {activeRequest.isSending ? "Sending…" : "Send"}
            </Button>
          </div>
          {urlError && <p className="text-sm text-destructive">{urlError}</p>}
          {unresolvedVariables.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Unresolved variable{unresolvedVariables.length > 1 ? "s" : ""}:{" "}
              {unresolvedVariables.map((name) => `{{${name}}}`).join(", ")}
            </p>
          )}
        </form>

        <div className="flex w-fit shrink-0 gap-1 rounded-lg bg-secondary p-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateActiveRequest({ activeSubTab: tab.id })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeRequest.activeSubTab === tab.id
                  ? "border border-input bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <div className="scrollbar-thin h-[340px] shrink-0 overflow-y-auto rounded-lg border border-input p-3 text-sm text-muted-foreground">
          {activeRequest.activeSubTab === "params" && (
            <KeyValueEditor rows={activeRequest.params} onUpdate={updateParam} onRemove={removeParam} />
          )}
          {activeRequest.activeSubTab === "headers" && (
            <KeyValueEditor rows={activeRequest.headers} onUpdate={updateHeader} onRemove={removeHeader} />
          )}
          {activeRequest.activeSubTab === "body" && (
            <div className="flex h-full min-h-0 flex-col gap-1.5">
              <textarea
                className="scrollbar-thin min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-md bg-muted/60 p-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:ring-2 aria-invalid:ring-destructive"
                placeholder={`{\n  "name": "Ada Lovelace",\n  "role": "engineer",\n  "tags": ["math", "computing"]\n}`}
                value={activeRequest.body}
                onChange={(e) => updateActiveRequest({ body: e.target.value })}
                onKeyDown={handleBodyKeyDown}
                onMouseDown={(e) => {
                  if (e.detail < 3) return;
                  e.preventDefault();
                  e.currentTarget.select();
                }}
                aria-invalid={bodyError !== null}
                spellCheck={false}
              />
              {bodyError && <p className="text-sm text-destructive">{bodyError}</p>}
            </div>
          )}
        </div>

        {activeRequest.error && (
          <Card className="shrink-0 rounded-lg border border-destructive ring-0">
            <CardContent>
              <p className="mb-2 font-semibold text-destructive">Error</p>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-destructive">
                {activeRequest.error}
              </pre>
            </CardContent>
          </Card>
        )}

        {activeRequest.response && (
          <Card className="shrink-0 gap-0 rounded-lg border border-input py-0 ring-0">
            <div className="flex items-center border-b px-4 py-3">
              <Badge
                variant={statusVariant(activeRequest.response.status)}
                className="font-mono text-sm"
              >
                {activeRequest.response.status}
              </Badge>
            </div>

            {Object.keys(activeRequest.response.headers).length > 0 && (
              <Collapsible className="border-b">
                <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Headers ({Object.keys(activeRequest.response.headers).length})
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="scrollbar-thin max-h-[200px] overflow-auto px-4 pb-2 font-mono text-sm">
                  {Object.entries(activeRequest.response.headers).map(([name, value]) => (
                    <div className="flex gap-2 py-0.5" key={name}>
                      <span className="text-muted-foreground">{name}</span>
                      <span className="break-all">{value}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            <pre className="scrollbar-thin max-h-[480px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm">
              {formatBody(activeRequest.response.body)}
            </pre>
          </Card>
        )}
      </div>
    </main>
    </>
  );
}

export default App;
