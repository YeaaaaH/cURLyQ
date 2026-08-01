import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { type KeyValuePair, ensureTrailingBlankRow, removeRow, stripEmptyRows, updateRows } from "@/lib/keyValue";
import { findAllVariableNames, getUnresolvedVariables, resolveRequest } from "@/lib/variables";
import type { VariableLookup } from "@/lib/variables/context";
import { buildCurlCommand } from "@/lib/curl";
import { parseParamsFromUrl, syncUrlWithParams } from "@/lib/requestUrl";
import type { Environment } from "@/lib/environments";
import { environmentToRecord, sendRequestWithScripts } from "@/lib/requestSend";
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
import { type RunResultTab, type Tab, createRunResultTab } from "@/lib/tabs";
import type { CollectionRunResult } from "@/lib/collectionRun";

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

  // Run results (Collection Run) open in the same strip as request tabs but
  // are never persisted — a run result is a snapshot of a past action, not
  // an editable document. Kept as a separate array rather than merged into
  // `requests` itself, so `requests`/`setRequests` stay exactly RequestTab[]
  // everywhere else in this hook; `allTabs` below is the merged view the tab
  // strip actually renders.
  const [runResultTabs, setRunResultTabs] = useState<RunResultTab[]>([]);
  const allTabs = useMemo<Tab[]>(() => [...requests, ...runResultTabs], [requests, runResultTabs]);

  // Falls back to the first request tab when `activeId` currently points at
  // a run-result tab — every computation below (urlError, curlCommand,
  // handleSend, etc.) needs *some* real RequestTab to operate on even though
  // its result won't be shown while a run-result tab is what's displayed
  // (App.tsx only renders the request-editing UI when the active tab's type
  // is "request").
  const activeRequest = requests.find((r) => r.id === activeId) ?? requests[0];

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
      type: "request",
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
    // Run-result tabs live in a separate array (see `runResultTabs` above) —
    // closing one never needs the "keep at least one" fallback a request
    // tab does, since there's always at least one request tab regardless.
    if (runResultTabs.some((r) => r.id === id)) {
      const remaining = runResultTabs.filter((r) => r.id !== id);
      setRunResultTabs(remaining);
      if (id === activeId) {
        setActiveId(remaining.length > 0 ? remaining[remaining.length - 1].id : requests[requests.length - 1].id);
      }
      return;
    }

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

  // Opens a finished Collection Run's results as a new tab, focused
  // immediately — same "just landed, look at it now" behavior as opening a
  // saved request.
  const addRunResultTab = useCallback((label: string, result: CollectionRunResult) => {
    const tab = createRunResultTab(label, result);
    setRunResultTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }, []);

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

    // A broken pre/post-request script doesn't block the send — it's
    // recorded as a failure in the Logs tab, and the request still goes out
    // with whatever the script managed to set up before it threw. Progress
    // callbacks update the tab as each stage completes (response shown as
    // soon as it arrives, not held back until the post-response script also
    // finishes), matching how a single send always behaved.
    const result = await sendRequestWithScripts(
      activeRequest,
      variableContext,
      environmentToRecord(activeEnvironment),
      applyEnvironmentPatch,
      {
        onPreScriptComplete: (scriptRun) => updateActiveRequest({ lastScriptRun: scriptRun }),
        onResponse: (response) => updateActiveRequest({ response, isSending: false }),
        onPostScriptComplete: (scriptRun) => updateActiveRequest({ lastScriptRun: scriptRun }),
      }
    );

    if (result.error) {
      updateActiveRequest({ error: result.error, isSending: false });
    }
    sendingTabIds.current.delete(tabId);
  }

  return {
    requests,
    allTabs,
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
    addRunResultTab,
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
