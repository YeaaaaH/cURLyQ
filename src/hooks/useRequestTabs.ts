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

  // Never persisted, so kept apart from `requests`.
  const [runResultTabs, setRunResultTabs] = useState<RunResultTab[]>([]);
  const allTabs = useMemo<Tab[]>(() => [...requests, ...runResultTabs], [requests, runResultTabs]);

  // While a run-result tab is active, values derived from this aren't shown.
  const activeRequest = requests.find((r) => r.id === activeId) ?? requests[0];

  // Lets memoized handlers read current tabs without changing identity per keystroke.
  const requestsRef = useRef(requests);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      invoke("save_tabs", { activeTabId: activeId, tabs: requests.map(toPersistedTab) });
    }, 500);
    return () => clearTimeout(timeout);
  }, [requests, activeId]);

  function updateActiveRequest(patch: Partial<RequestTab>) {
    setRequests((prev) => prev.map((r) => (r.id === activeId ? { ...r, ...patch } : r)));
  }

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

  // On blur only, so typing doesn't re-render the collection tree per keystroke.
  function handleCommitRequestName() {
    const finalName = activeRequest.name.trim() === "" ? "Untitled request" : activeRequest.name;
    updateActiveRequest({ name: finalName });
    if (activeRequest.sourceRequestId && activeRequest.sourceCollectionId) {
      setCollections((prev) =>
        renameCollectionNode(prev, activeRequest.sourceCollectionId!, activeRequest.sourceRequestId!, finalName)
      );
    }
  }

  function handleUpdateMethod(method: string) {
    updateActiveRequest({ method });
    if (activeRequest.sourceRequestId && activeRequest.sourceCollectionId) {
      setCollections((prev) =>
        updateCollectionRequestMethod(prev, activeRequest.sourceCollectionId!, activeRequest.sourceRequestId!, method)
      );
    }
  }

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

  // Always creates a new node, even for "Save as" on a linked tab.
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

  // A ref, not `isSending`: a double-click calls this twice before the re-render.
  const sendingTabIds = useRef<Set<string>>(new Set());

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const tabId = activeRequest.id;
    if (!canSend || sendingTabIds.current.has(tabId)) return;
    sendingTabIds.current.add(tabId);
    updateActiveRequest({ error: null, response: null, isSending: true });

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
