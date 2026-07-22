import { useState } from "react";
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
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
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

interface RequestTab {
  id: string;
  name: string;
  method: string;
  url: string;
  activeSubTab: SubTab;
  params: KeyValuePair[];
  headers: KeyValuePair[];
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

function getUrlError(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a full URL, e.g. https://example.com";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }
  return null;
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

function buildDisplayUrl(rawUrl: string, params: KeyValuePair[]): string {
  const url = new URL(rawUrl);
  const query = params
    .filter(({ key, enabled }) => enabled && key.trim() !== "")
    .map(({ key, value }) => `${escapeForDisplay(key)}=${escapeForDisplay(value)}`)
    .join("&");
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

function syncUrlWithParams(rawUrl: string, params: KeyValuePair[]): string {
  try {
    return buildDisplayUrl(rawUrl, params);
  } catch {
    return rawUrl;
  }
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

function KeyValueEditor({
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
}

function App() {
  const [requests, setRequests] = useState<RequestTab[]>(() => [createRequestTab()]);
  const [activeId, setActiveId] = useState(() => requests[0].id);

  const activeRequest = requests.find((r) => r.id === activeId)!;

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

  function updateParam(index: number, patch: Partial<KeyValuePair>) {
    const params = updateRows(activeRequest.params, index, patch);
    updateActiveRequest({ params, url: syncUrlWithParams(activeRequest.url, params) });
  }

  function removeParam(index: number) {
    const params = removeRow(activeRequest.params, index);
    updateActiveRequest({ params, url: syncUrlWithParams(activeRequest.url, params) });
  }

  function updateHeader(index: number, patch: Partial<KeyValuePair>) {
    updateActiveRequest({ headers: updateRows(activeRequest.headers, index, patch) });
  }

  function removeHeader(index: number) {
    updateActiveRequest({ headers: removeRow(activeRequest.headers, index) });
  }

  function handleUrlChange(rawUrl: string) {
    if (rawUrl.trim() === "") {
      updateActiveRequest({
        url: rawUrl,
        params: [{ id: crypto.randomUUID(), key: "", value: "", enabled: true }],
      });
      return;
    }
    try {
      const parsed = new URL(rawUrl);
      const params: KeyValuePair[] = [...parsed.searchParams.entries()].map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value,
        enabled: true,
      }));
      params.push({ id: crypto.randomUUID(), key: "", value: "", enabled: true });
      updateActiveRequest({ url: rawUrl, params });
    } catch {
      updateActiveRequest({ url: rawUrl });
    }
  }

  const isUrlEmpty = activeRequest.url.trim() === "";
  const urlError = getUrlError(activeRequest.url);
  const canSend = !isUrlEmpty && !urlError;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    const { method, url, params, headers } = activeRequest;
    const requestUrl = buildRequestUrl(url, params);
    const requestHeaders = headers
      .filter(({ key, enabled }) => enabled && key.trim() !== "")
      .map(({ key, value }) => [key, value] as [string, string]);
    updateActiveRequest({ error: null, response: null, isSending: true });
    try {
      const result = await invoke<HttpResponse>("send_request", {
        method,
        url: requestUrl,
        headers: requestHeaders,
      });
      updateActiveRequest({ response: result, isSending: false });
    } catch (err) {
      updateActiveRequest({ error: String(err), isSending: false });
    }
  }

  return (
    <main className="flex flex-col gap-5 p-8">
      <div className="flex flex-col gap-3">
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
        </div>

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
          className="-ml-2 w-full rounded-md bg-transparent px-2 py-1 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
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
        </form>

        <div className="flex flex-col gap-2">
          <div className="flex w-fit gap-1 rounded-lg bg-secondary p-1">
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

          <div className="min-h-[220px] rounded-lg border border-input p-3 text-sm text-muted-foreground">
            {activeRequest.activeSubTab === "params" && (
              <KeyValueEditor rows={activeRequest.params} onUpdate={updateParam} onRemove={removeParam} />
            )}
            {activeRequest.activeSubTab === "headers" && (
              <KeyValueEditor rows={activeRequest.headers} onUpdate={updateHeader} onRemove={removeHeader} />
            )}
            {activeRequest.activeSubTab === "body" && "No body yet."}
          </div>
        </div>
      </div>

      {activeRequest.error && (
        <Card className="border-destructive">
          <CardContent>
            <p className="mb-2 font-semibold text-destructive">Error</p>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-destructive">
              {activeRequest.error}
            </pre>
          </CardContent>
        </Card>
      )}

      {activeRequest.response && (
        <Card className="gap-0 py-0">
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
              <CollapsibleContent className="max-h-[200px] overflow-auto px-4 pb-2 font-mono text-sm">
                {Object.entries(activeRequest.response.headers).map(([name, value]) => (
                  <div className="flex gap-2 py-0.5" key={name}>
                    <span className="text-muted-foreground">{name}</span>
                    <span className="break-all">{value}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm">
            {formatBody(activeRequest.response.body)}
          </pre>
        </Card>
      )}
    </main>
  );
}

export default App;
