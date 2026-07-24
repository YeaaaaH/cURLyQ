import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type KeyValuePair,
  ensureTrailingBlankRow,
  removeRow,
  stripEmptyRows,
  updateRows,
} from "@/lib/keyValue";
import {
  type Environment,
  createEnvironment,
  getUnresolvedVariables,
  nextEnvironmentName,
  substituteVariables,
} from "@/lib/environments";
import { buildRequestUrl, parseParamsFromUrl, syncUrlWithParams } from "@/lib/requestUrl";
import type { HttpResponse } from "@/lib/http";
import {
  type PersistedTabsFile,
  type RequestTab,
  createRequestTab,
  fromPersistedTab,
  getBodyError,
  getUrlError,
  toPersistedTab,
} from "@/lib/requestTabs";
import { Sidebar } from "@/components/Sidebar";
import { TabBar } from "@/components/TabBar";
import { RequestEditor } from "@/components/RequestEditor";
import { RequestPanel } from "@/components/RequestPanel";
import { ResponseViewer } from "@/components/ResponseViewer";

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
      <Sidebar
        sidebarWidth={sidebarWidth}
        onHandlePointerDown={handleSidebarHandlePointerDown}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={setActiveEnvironmentId}
        onEditEnvironment={openEnvironmentEditor}
        onAddEnvironment={handleAddEnvironment}
      />

      <main
        className="flex h-screen flex-col gap-5 overflow-hidden p-8 transition-[margin-left] duration-150"
        style={{ marginLeft: sidebarWidth }}
      >
      <div className="flex shrink-0 flex-col gap-3">
        <TabBar
          requests={requests}
          activeId={activeId}
          onSelectTab={setActiveId}
          onCloseTab={handleCloseTab}
          onAddTab={handleAddTab}
          onWheel={handleTabsWheel}
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onSelectEnvironment={setActiveEnvironmentId}
          onEditEnvironment={openEnvironmentEditor}
          environmentEditorOpen={environmentEditorOpen}
          onEnvironmentEditorOpenChange={setEnvironmentEditorOpen}
          editingEnvironmentId={editingEnvironmentId}
          onSelectEditingEnvironment={setEditingEnvironmentId}
          onAddEnvironment={handleAddEnvironment}
          onRenameEnvironment={handleRenameEnvironment}
          onDeleteEnvironment={handleDeleteEnvironment}
          onUpdateEnvironmentVariable={updateEnvironmentVariable}
          onRemoveEnvironmentVariable={removeEnvironmentVariable}
        />

        <RequestEditor
          activeRequest={activeRequest}
          onUpdate={updateActiveRequest}
          onUrlChange={handleUrlChange}
          onSend={handleSend}
          canSend={canSend}
          urlError={urlError}
          unresolvedVariables={unresolvedVariables}
        />
      </div>

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <RequestPanel
          activeRequest={activeRequest}
          onUpdate={updateActiveRequest}
          updateParam={updateParam}
          removeParam={removeParam}
          updateHeader={updateHeader}
          removeHeader={removeHeader}
          onBodyKeyDown={handleBodyKeyDown}
          bodyError={bodyError}
        />

        <ResponseViewer error={activeRequest.error} response={activeRequest.response} />
      </div>
    </main>
    </>
  );
}

export default App;
