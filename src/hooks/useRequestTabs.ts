import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { type KeyValuePair, ensureTrailingBlankRow, removeRow, stripEmptyRows, updateRows } from "@/lib/keyValue";
import { findAllVariableNames, getUnresolvedVariables, resolveRequest } from "@/lib/variables";
import type { VariableLookup } from "@/lib/variables/context";
import { buildCurlCommand } from "@/lib/curl";
import { parseParamsFromUrl, syncUrlWithParams } from "@/lib/requestUrl";
import type { HttpResponse } from "@/lib/http";
import type { Environment } from "@/lib/environments";
import { runPostResponseScript, runPreRequestScript } from "@/lib/scripting/runScript";
import { toggleLineComment } from "@/lib/textEditing";
import {
  type PersistedTabsFile,
  type RequestTab,
  createEmptyScriptRun,
  createRequestTab,
  fromPersistedTab,
  getBodyError,
  getUrlError,
  toPersistedTab,
} from "@/lib/requestTabs";
import {
  type Collection,
  type RequestNode,
  addNodeToCollection,
  renameCollectionNode,
  updateCollectionRequestFields,
  updateCollectionRequestMethod,
} from "@/lib/collections";

// Flattens the active environment's enabled, non-empty-key variables into the
// plain Record a script sandbox worker can receive via postMessage (a
// VariableLookup's `.lookup()` closure can't cross that boundary).
function environmentToRecord(environment: Environment | null): Record<string, string> {
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
// unseen one. Only ever affects the copy used for this one send — never
// written back into the tab's own editable Headers rows.
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
// reflected in `variableContext` until the next render — too late for this
// same send. Layering the patch in front of the existing lookup gives
// `resolveRequest` an immediately up-to-date view without waiting on that
// re-render.
function withEnvironmentPatch(base: VariableLookup, patch: Record<string, string>): VariableLookup {
  if (Object.keys(patch).length === 0) return base;
  return {
    lookup(name) {
      return name in patch ? patch[name] : base.lookup(name);
    },
  };
}

interface UseRequestTabsParams {
  variableContext: VariableLookup;
  activeEnvironment: Environment | null;
  applyEnvironmentPatch: (patch: Record<string, string>) => void;
  setCollections: React.Dispatch<React.SetStateAction<Collection[]>>;
}

export function useRequestTabs({
  variableContext,
  activeEnvironment,
  applyEnvironmentPatch,
  setCollections,
}: UseRequestTabsParams) {
  const [requests, setRequests] = useState<RequestTab[]>(() => [createRequestTab()]);
  const [activeId, setActiveId] = useState(() => requests[0].id);
  const activeRequest = requests.find((r) => r.id === activeId)!;

  // Mirrors `requests` for the handlers below that need the *current* tab
  // list but are also passed down to a `React.memo`'d Sidebar
  // (`closeTabsForRequestIds`, `openCollectionRequestTab`,
  // `handleOpenCollectionRequest`) — `requests` changes on every keystroke
  // in the active tab's URL/body/params/headers, so taking it as a
  // `useCallback` dependency would give those handlers a new identity every
  // keystroke too, defeating Sidebar's memoization entirely. Reading
  // `requestsRef.current` instead means they can stay referentially stable
  // while still seeing up-to-date tab data.
  const requestsRef = useRef(requests);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

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

  // Closes every open tab whose sourceRequestId is in `deletedIds` (a request
  // being deleted directly, or every request that was nested inside a deleted
  // folder/collection) — an open tab shouldn't keep pointing at a request that
  // no longer exists. Falls back to a fresh blank tab if that closes the last
  // one, or to the first remaining tab if the active tab specifically was
  // among those closed. Reads `requestsRef`/`setActiveId`'s functional form
  // (not `requests`/`activeId` directly) so this stays referentially stable
  // — see the `requestsRef` comment above.
  const closeTabsForRequestIds = useCallback((deletedIds: Set<string>) => {
    if (deletedIds.size === 0) return;
    const current = requestsRef.current;
    const remaining = current.filter((r) => !r.sourceRequestId || !deletedIds.has(r.sourceRequestId));
    if (remaining.length === current.length) return;
    if (remaining.length === 0) {
      const fresh = createRequestTab();
      setRequests([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setRequests(remaining);
    setActiveId((prevActiveId) =>
      remaining.some((r) => r.id === prevActiveId) ? prevActiveId : remaining[0].id
    );
  }, []);

  const openCollectionRequestTab = useCallback((collectionId: string, node: RequestNode) => {
    const tab: RequestTab = {
      id: crypto.randomUUID(),
      name: node.name,
      method: node.method,
      url: node.url,
      activeSubTab: "params",
      params: ensureTrailingBlankRow(node.params),
      headers: ensureTrailingBlankRow(node.headers),
      body: node.body,
      preRequestScript: node.preRequestScript,
      postResponseScript: node.postResponseScript,
      activeScriptTab: "pre-request",
      lastScriptRun: createEmptyScriptRun(),
      response: null,
      error: null,
      isSending: false,
      sourceRequestId: node.id,
      sourceCollectionId: collectionId,
    };
    setRequests((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }, []);

  // Opening the same saved request twice focuses the existing tab instead of
  // piling up duplicates.
  const handleOpenCollectionRequest = useCallback(
    (collectionId: string, node: RequestNode) => {
      const existingTab = requestsRef.current.find((r) => r.sourceRequestId === node.id);
      if (existingTab) {
        setActiveId(existingTab.id);
        return;
      }
      openCollectionRequestTab(collectionId, node);
    },
    [openCollectionRequestTab]
  );

  // Renaming a tab that was opened from (or saved to) a collection request
  // keeps the two names in sync — deliberately only on blur (not every
  // keystroke) so typing a name doesn't re-render the whole collection tree
  // per character, the same lag bug fixed for environment renaming (see
  // ui-polish PLAN.md Item 3).
  function handleCommitRequestName() {
    const finalName = activeRequest.name.trim() === "" ? "Untitled request" : activeRequest.name;
    updateActiveRequest({ name: finalName });
    if (activeRequest.sourceRequestId && activeRequest.sourceCollectionId) {
      setCollections((prev) =>
        renameCollectionNode(prev, activeRequest.sourceCollectionId!, activeRequest.sourceRequestId!, finalName)
      );
    }
  }

  // Same live-sync shortcut as the name above, for method — a Select's
  // onValueChange is already a single discrete pick (not a keystroke stream),
  // so there's no lag risk here that would call for a blur-only debounce.
  function handleUpdateMethod(method: string) {
    updateActiveRequest({ method });
    if (activeRequest.sourceRequestId && activeRequest.sourceCollectionId) {
      setCollections((prev) =>
        updateCollectionRequestMethod(prev, activeRequest.sourceCollectionId!, activeRequest.sourceRequestId!, method)
      );
    }
  }

  // Persists the active tab's current field values into the collection
  // request it's already linked to. Only meaningful when a source exists —
  // RequestEditor decides whether to call this or open the "Save to..."
  // picker instead (a fresh, never-saved tab has nowhere to save *to* yet),
  // since it already owns that picker's state.
  function handleSaveActiveRequestInPlace() {
    setCollections((prev) =>
      updateCollectionRequestFields(prev, activeRequest.sourceCollectionId!, activeRequest.sourceRequestId!, {
        name: activeRequest.name,
        method: activeRequest.method,
        url: activeRequest.url,
        params: stripEmptyRows(activeRequest.params),
        headers: stripEmptyRows(activeRequest.headers),
        body: activeRequest.body,
        preRequestScript: activeRequest.preRequestScript,
        postResponseScript: activeRequest.postResponseScript,
      })
    );
    toast.success(`Saved "${activeRequest.name}"`);
  }

  // Confirming the "Save to..." picker always creates a brand-new request
  // node (even for "Save as" on an already-linked tab, which is exactly the
  // fork behavior that action is for) and re-points the active tab at it, so
  // the tab that's open keeps editing whatever it was just saved as.
  function handleConfirmSaveTo(collectionId: string, parentFolderId: string | null, name: string) {
    const node: RequestNode = {
      type: "request",
      id: crypto.randomUUID(),
      name,
      method: activeRequest.method,
      url: activeRequest.url,
      params: stripEmptyRows(activeRequest.params),
      headers: stripEmptyRows(activeRequest.headers),
      body: activeRequest.body,
      preRequestScript: activeRequest.preRequestScript,
      postResponseScript: activeRequest.postResponseScript,
    };
    setCollections((prev) => addNodeToCollection(prev, collectionId, parentFolderId, node));
    updateActiveRequest({ name, sourceRequestId: node.id, sourceCollectionId: collectionId });
    toast.success(`Saved "${name}"`);
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
    if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const next = toggleLineComment(textarea.value, textarea.selectionStart, textarea.selectionEnd);
      updateActiveRequest({ body: next.value });
      requestAnimationFrame(() => textarea.setSelectionRange(next.selectionStart, next.selectionEnd));
      return;
    }
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
    () => getUrlError(activeRequest.url, variableContext),
    [activeRequest.url, variableContext]
  );
  const bodyError = useMemo(
    () => getBodyError(activeRequest.body, variableContext),
    [activeRequest.body, variableContext]
  );
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
        variableContext
      ),
    [activeRequest.url, activeRequest.params, activeRequest.headers, activeRequest.body, variableContext]
  );

  const requestVariableNames = useMemo(
    () =>
      findAllVariableNames([
        activeRequest.url,
        ...activeRequest.params.map((p) => p.value),
        ...activeRequest.headers.map((h) => h.value),
        activeRequest.body,
      ]),
    [activeRequest.url, activeRequest.params, activeRequest.headers, activeRequest.body]
  );
  const curlCommand = useMemo(() => {
    const { method, url, headers, body } = resolveRequest(activeRequest, variableContext);
    return buildCurlCommand(method, url, headers, body);
  }, [activeRequest, variableContext]);

  // Guards against a double-send on the same tab: the Send button already
  // disables while `isSending` is true, but that's React state, which only
  // takes effect on the next render. A double-click (or Enter fired twice in
  // quick succession) can call handleSend a second time before that render
  // happens, both invocations still closing over the same stale
  // `isSending: false`. This ref is checked and set synchronously instead, so
  // it can't miss the same race. Keyed by tab id (not a single flag) since
  // sending from two different tabs at once is intentionally allowed.
  const sendingTabIds = useRef<Set<string>>(new Set());

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const tabId = activeRequest.id;
    if (!canSend || sendingTabIds.current.has(tabId)) return;
    sendingTabIds.current.add(tabId);
    updateActiveRequest({ error: null, response: null, isSending: true });

    let lastScriptRun = activeRequest.lastScriptRun;
    let requestForSend = activeRequest;
    let effectiveContext = variableContext;

    if (activeRequest.preRequestScript.trim() !== "") {
      const preResult = await runPreRequestScript(
        activeRequest.preRequestScript,
        { headers: headersToRecord(activeRequest.headers), body: activeRequest.body },
        environmentToRecord(activeEnvironment)
      );
      lastScriptRun = { ...lastScriptRun, pre: preResult };
      updateActiveRequest({ lastScriptRun });

      // A broken pre-request script doesn't block the send — it's recorded
      // as a failure in the Logs tab (same treatment a post-response script
      // error gets), and the request still goes out with whatever the
      // script managed to set up before it threw.
      if (Object.keys(preResult.environmentPatch).length > 0) applyEnvironmentPatch(preResult.environmentPatch);
      effectiveContext = withEnvironmentPatch(variableContext, preResult.environmentPatch);

      if (preResult.requestPatch) {
        requestForSend = {
          ...activeRequest,
          headers: preResult.requestPatch.headers
            ? applyHeaderPatch(activeRequest.headers, preResult.requestPatch.headers)
            : activeRequest.headers,
          body: preResult.requestPatch.body ?? activeRequest.body,
        };
      }
    }

    const { method, url, headers, body } = resolveRequest(requestForSend, effectiveContext);

    try {
      const result = await invoke<HttpResponse>("send_request", { method, url, headers, body });
      updateActiveRequest({ response: result, isSending: false });

      if (activeRequest.postResponseScript.trim() !== "") {
        const postResult = await runPostResponseScript(
          activeRequest.postResponseScript,
          { status: result.status, headers: Object.fromEntries(result.headers), body: result.body },
          environmentToRecord(activeEnvironment)
        );
        updateActiveRequest({ lastScriptRun: { ...lastScriptRun, post: postResult } });
        if (Object.keys(postResult.environmentPatch).length > 0) applyEnvironmentPatch(postResult.environmentPatch);
      }
    } catch (err) {
      updateActiveRequest({ error: String(err), isSending: false });
    } finally {
      sendingTabIds.current.delete(tabId);
    }
  }

  return {
    requests,
    activeId,
    setActiveId,
    activeRequest,
    updateActiveRequest,
    closeTabsForRequestIds,
    openCollectionRequestTab,
    handleOpenCollectionRequest,
    handleCommitRequestName,
    handleUpdateMethod,
    handleSaveActiveRequestInPlace,
    handleConfirmSaveTo,
    handleAddTab,
    handleCloseTab,
    updateParam,
    removeParam,
    updateHeader,
    removeHeader,
    handleBodyKeyDown,
    handleUrlChange,
    handleSend,
    isUrlEmpty,
    urlError,
    bodyError,
    canSend,
    unresolvedVariables,
    requestVariableNames,
    curlCommand,
  };
}
