import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type KeyValuePair,
  ensureTrailingBlankRow,
  removeRow,
  stripEmptyRows,
  updateRows,
} from "@/lib/keyValue";
import {
  type Environment,
  buildPostmanEnvironment,
  createEnvironment,
  nextEnvironmentName,
  parsePostmanEnvironment,
} from "@/lib/environments";
import {
  createVariableContext,
  environmentScope,
  findAllVariableNames,
  getUnresolvedVariables,
  resolveRequest,
} from "@/lib/variables";
import { buildCurlCommand } from "@/lib/curl";
import { PostmanImportError } from "@/lib/postman";
import { parseParamsFromUrl, syncUrlWithParams } from "@/lib/requestUrl";
import { type ImportExportLogEntry, pluralize, pushLogEntry } from "@/lib/importExportLog";
import {
  type Collection,
  type RequestNode,
  addNodeToCollection,
  buildPostmanCollection,
  collectRequestIds,
  countNodes,
  createCollection,
  createFolderNode,
  createRequestNode,
  deleteCollection,
  deleteCollectionNode,
  findCollectionNode,
  moveNodeRelativeToTarget,
  parsePostmanCollection,
  renameCollection,
  renameCollectionNode,
  updateCollectionRequestFields,
  updateCollectionRequestMethod,
} from "@/lib/collections";
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
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TabBar } from "@/components/tab-bar/TabBar";
import { RequestEditor } from "@/components/request-editor/RequestEditor";
import { VariablesPanel } from "@/components/variables-panel/VariablesPanel";
import { RequestVariablesTabs } from "@/components/request-variables-tabs/RequestVariablesTabs";
import { ResponseContainer } from "@/components/ResponseContainer";

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
  // The one shared lookup every variable-consuming call below resolves
  // against — wraps the active environment as a `VariableScope` so a future
  // second scope (e.g. collection-level variables) only means adding another
  // scope to this list, not touching every call site again.
  const variableContext = useMemo(
    () => createVariableContext([environmentScope(activeEnvironment)]),
    [activeEnvironment]
  );

  const [collections, setCollections] = useState<Collection[]>([]);

  // Restore saved collections, if any, on mount.
  useEffect(() => {
    invoke<Collection[]>("load_collections").then((saved) => {
      if (saved.length > 0) setCollections(saved);
    });
  }, []);

  // Debounced autosave, same pattern as environments/tabs.
  useEffect(() => {
    const timeout = setTimeout(() => {
      invoke("save_collections", { collections });
    }, 500);
    return () => clearTimeout(timeout);
  }, [collections]);

  function handleAddCollection(): string {
    const collection = createCollection("New Collection");
    setCollections((prev) => [...prev, collection]);
    return collection.id;
  }

  function handleRenameCollection(id: string, name: string) {
    setCollections((prev) => renameCollection(prev, id, name));
  }

  function handleDeleteCollection(id: string) {
    const collection = collections.find((c) => c.id === id);
    setCollections((prev) => deleteCollection(prev, id));
    if (collection) {
      closeTabsForRequestIds(new Set(collection.items.flatMap(collectRequestIds)));
    }
  }

  function handleAddFolder(collectionId: string, parentFolderId: string | null): string {
    const folder = createFolderNode("New Folder");
    setCollections((prev) => addNodeToCollection(prev, collectionId, parentFolderId, folder));
    return folder.id;
  }

  // Creating a request always opens it in a new tab immediately, since the
  // tree row alone has nowhere to edit method/URL/params — same reasoning as
  // why folders (which have nothing to "open") stay in tree-inline-rename
  // instead.
  function handleAddRequestNode(collectionId: string, parentFolderId: string | null): string {
    const node = createRequestNode("New Request");
    setCollections((prev) => addNodeToCollection(prev, collectionId, parentFolderId, node));
    openCollectionRequestTab(collectionId, node);
    return node.id;
  }

  function handleRenameCollectionNode(collectionId: string, nodeId: string, name: string) {
    setCollections((prev) => renameCollectionNode(prev, collectionId, nodeId, name));
  }

  function handleDeleteCollectionNode(collectionId: string, nodeId: string) {
    const node = findCollectionNode(collections, collectionId, nodeId);
    setCollections((prev) => deleteCollectionNode(prev, collectionId, nodeId));
    if (node) {
      closeTabsForRequestIds(new Set(collectRequestIds(node)));
    }
  }

  // Closes every open tab whose sourceRequestId is in `deletedIds` (a request
  // being deleted directly, or every request that was nested inside a deleted
  // folder/collection) — an open tab shouldn't keep pointing at a request that
  // no longer exists. Falls back to a fresh blank tab if that closes the last
  // one, or to the first remaining tab if the active tab specifically was
  // among those closed.
  function closeTabsForRequestIds(deletedIds: Set<string>) {
    if (deletedIds.size === 0) return;
    const remaining = requests.filter((r) => !r.sourceRequestId || !deletedIds.has(r.sourceRequestId));
    if (remaining.length === requests.length) return;
    if (remaining.length === 0) {
      const fresh = createRequestTab();
      setRequests([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setRequests(remaining);
    if (!remaining.some((r) => r.id === activeId)) {
      setActiveId(remaining[0].id);
    }
  }

  function handleMoveCollectionNode(draggedId: string, targetId: string) {
    setCollections((prev) => moveNodeRelativeToTarget(prev, draggedId, targetId));
  }

  function openCollectionRequestTab(collectionId: string, node: RequestNode) {
    const tab: RequestTab = {
      id: crypto.randomUUID(),
      name: node.name,
      method: node.method,
      url: node.url,
      activeSubTab: "params",
      params: ensureTrailingBlankRow(node.params),
      headers: ensureTrailingBlankRow(node.headers),
      body: node.body,
      response: null,
      error: null,
      isSending: false,
      sourceRequestId: node.id,
      sourceCollectionId: collectionId,
    };
    setRequests((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }

  // Opening the same saved request twice focuses the existing tab instead of
  // piling up duplicates.
  function handleOpenCollectionRequest(collectionId: string, node: RequestNode) {
    const existingTab = requests.find((r) => r.sourceRequestId === node.id);
    if (existingTab) {
      setActiveId(existingTab.id);
      return;
    }
    openCollectionRequestTab(collectionId, node);
  }

  // A drag-to-open sidebar (rather than a click toggle) for browsing many
  // environments at once. Matches Postman's feel: a short pull past a small
  // threshold snaps straight open (not a continuous pixel-by-pixel resize),
  // and pulling back the other way snaps it shut. Tracked as open/closed
  // rather than a computed pixel width — the actual width is a live `vw`
  // Tailwind class (see Sidebar.tsx), so it stays in sync with the window
  // size on its own instead of going stale the moment the window is resized
  // again without re-dragging the handle.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleSidebarHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const wasOpen = sidebarOpen;
    const threshold = 48;
    let toggled = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      if (toggled) return;
      const delta = moveEvent.clientX - startX;
      if (!wasOpen && delta > threshold) {
        setSidebarOpen(true);
        toggled = true;
      } else if (wasOpen && delta < -threshold) {
        setSidebarOpen(false);
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
  const [importExportLog, setImportExportLog] = useState<ImportExportLogEntry[]>([]);

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

  async function handleImportEnvironment() {
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const fileName = path.split(/[\\/]/).pop() ?? path;

    try {
      const raw = await invoke<string>("read_text_file", { path });
      const environment = parsePostmanEnvironment(JSON.parse(raw), environments);
      setEnvironments((prev) => [...prev, environment]);
      setEditingEnvironmentId(environment.id);
      setEnvironmentEditorOpen(true);
      const detail = pluralize(
        environment.variables.filter((v) => v.key.trim() !== "").length,
        "variable"
      );
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "import",
          kind: "environment",
          label: environment.name,
          detail,
          status: "success",
        })
      );
      toast.success(`Imported "${environment.name}"`, { description: detail });
    } catch (err) {
      const message = err instanceof PostmanImportError ? err.message : String(err);
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "import",
          kind: "environment",
          label: fileName,
          status: "error",
          message,
        })
      );
      toast.error(`Couldn't import "${fileName}"`, { description: message });
    }
  }

  async function handleExportEnvironment(id: string) {
    const environment = environments.find((e) => e.id === id);
    if (!environment) return;

    const path = await save({
      defaultPath: `${environment.name}.postman_environment.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;

    const detail = pluralize(
      environment.variables.filter((v) => v.key.trim() !== "").length,
      "variable"
    );
    try {
      const json = JSON.stringify(buildPostmanEnvironment(environment), null, 2);
      await invoke("write_text_file", { path, contents: json });
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "export",
          kind: "environment",
          label: environment.name,
          detail,
          status: "success",
        })
      );
      toast.success(`Exported "${environment.name}"`, { description: detail });
    } catch (err) {
      const message = String(err);
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "export",
          kind: "environment",
          label: environment.name,
          status: "error",
          message,
        })
      );
      toast.error(`Couldn't export "${environment.name}"`, { description: message });
    }
  }

  function describeCollectionCounts(items: Collection["items"]): string {
    const counts = countNodes(items);
    const parts: string[] = [];
    if (counts.folders > 0) parts.push(pluralize(counts.folders, "folder"));
    if (counts.requests > 0) parts.push(pluralize(counts.requests, "request"));
    return parts.length > 0 ? parts.join(", ") : "empty";
  }

  async function handleImportCollection() {
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const fileName = path.split(/[\\/]/).pop() ?? path;

    try {
      const raw = await invoke<string>("read_text_file", { path });
      const { collection, skippedBodyCount } = parsePostmanCollection(JSON.parse(raw), collections);
      setCollections((prev) => [...prev, collection]);
      const detail = describeCollectionCounts(collection.items);
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "import",
          kind: "collection",
          label: collection.name,
          detail,
          status: "success",
        })
      );
      toast.success(`Imported "${collection.name}"`, {
        description:
          skippedBodyCount > 0
            ? `${detail} — ${pluralize(skippedBodyCount, "request")} had an unsupported body, imported empty`
            : detail,
      });
    } catch (err) {
      const message = err instanceof PostmanImportError ? err.message : String(err);
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "import",
          kind: "collection",
          label: fileName,
          status: "error",
          message,
        })
      );
      toast.error(`Couldn't import "${fileName}"`, { description: message });
    }
  }

  async function handleExportCollection(id: string) {
    const collection = collections.find((c) => c.id === id);
    if (!collection) return;

    const path = await save({
      defaultPath: `${collection.name}.postman_collection.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;

    const detail = describeCollectionCounts(collection.items);
    try {
      const json = JSON.stringify(buildPostmanCollection(collection), null, 2);
      await invoke("write_text_file", { path, contents: json });
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "export",
          kind: "collection",
          label: collection.name,
          detail,
          status: "success",
        })
      );
      toast.success(`Exported "${collection.name}"`, { description: detail });
    } catch (err) {
      const message = String(err);
      setImportExportLog((prev) =>
        pushLogEntry(prev, {
          direction: "export",
          kind: "collection",
          label: collection.name,
          status: "error",
          message,
        })
      );
      toast.error(`Couldn't export "${collection.name}"`, { description: message });
    }
  }

  function handleDeleteEnvironment(id: string) {
    const remaining = environments.filter((e) => e.id !== id);
    setEnvironments(remaining);
    if (activeEnvironmentId === id) setActiveEnvironmentId(null);
    if (editingEnvironmentId === id) setEditingEnvironmentId(remaining[0]?.id ?? null);
  }

  // Only environments that actually have variables get a confirmation —
  // deleting an empty one is low-risk and stays instant, matching the same
  // rule collections already use for folders/collections.
  const [pendingDeleteEnvironment, setPendingDeleteEnvironment] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  function requestDeleteEnvironment(id: string) {
    const environment = environments.find((e) => e.id === id);
    const variableCount = environment?.variables.filter((v) => v.key.trim() !== "").length ?? 0;
    if (environment && variableCount > 0) {
      setPendingDeleteEnvironment({
        title: `Delete "${environment.name}"?`,
        description: `This environment has ${variableCount} variable${
          variableCount === 1 ? "" : "s"
        }. Deleting it can't be undone.`,
        onConfirm: () => handleDeleteEnvironment(id),
      });
      return;
    }
    handleDeleteEnvironment(id);
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

  // Edits a variable's value straight from the {{var}} hover popup, by name,
  // in whichever environment is active — deliberately independent of
  // `editingEnvironmentId` above, since the popup can be used whether or not
  // the Environment editor dialog happens to be open.
  const updateActiveEnvironmentVariable = useCallback(
    (name: string, value: string) => {
      if (activeEnvironmentId === null) return;
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === activeEnvironmentId
            ? { ...e, variables: e.variables.map((v) => (v.key === name ? { ...v, value } : v)) }
            : e
        )
      );
    },
    [activeEnvironmentId]
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
      })
    );
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
    };
    setCollections((prev) => addNodeToCollection(prev, collectionId, parentFolderId, node));
    updateActiveRequest({ name, sourceRequestId: node.id, sourceCollectionId: collectionId });
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

  // Drag-to-open, same mechanic as the left Sidebar (see
  // handleSidebarHandlePointerDown) mirrored horizontally: dragging the
  // handle left past the threshold opens it, dragging right past the
  // threshold (while open) closes it.
  const [variablesPanelOpen, setVariablesPanelOpen] = useState(false);

  function handleVariablesPanelHandlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const wasOpen = variablesPanelOpen;
    const threshold = 48;
    let toggled = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      if (toggled) return;
      const delta = moveEvent.clientX - startX;
      if (!wasOpen && delta < -threshold) {
        setVariablesPanelOpen(true);
        toggled = true;
      } else if (wasOpen && delta > threshold) {
        setVariablesPanelOpen(false);
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

  // A live-resizing window with a docked panel open looks jarring (text
  // rewrapping, the cURL block reflowing) — simplest is to just close
  // whichever panel is open rather than trying to animate through it.
  useEffect(() => {
    function handleWindowResize() {
      setSidebarOpen(false);
      setVariablesPanelOpen(false);
    }
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    const { method, url, headers, body } = resolveRequest(activeRequest, variableContext);

    updateActiveRequest({ error: null, response: null, isSending: true });
    try {
      const result = await invoke<HttpResponse>("send_request", { method, url, headers, body });
      updateActiveRequest({ response: result, isSending: false });
    } catch (err) {
      updateActiveRequest({ error: String(err), isSending: false });
    }
  }

  // Shared by every variable-aware field (URL, and — from Stage 3 —
  // header/param values) so each one jumps to the same place instead of
  // each needing its own inline closure.
  function handleOpenEnvironment() {
    if (activeEnvironmentId) openEnvironmentEditor(activeEnvironmentId);
  }
  function handleOpenVariablesPanel() {
    setVariablesPanelOpen(true);
  }

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <AlertDialog
        open={pendingDeleteEnvironment !== null}
        onOpenChange={(open) => !open && setPendingDeleteEnvironment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDeleteEnvironment?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDeleteEnvironment?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingDeleteEnvironment?.onConfirm();
                setPendingDeleteEnvironment(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Sidebar
        sidebarOpen={sidebarOpen}
        onHandlePointerDown={handleSidebarHandlePointerDown}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={setActiveEnvironmentId}
        onEditEnvironment={openEnvironmentEditor}
        onAddEnvironment={handleAddEnvironment}
        onImportEnvironment={handleImportEnvironment}
        onImportCollection={handleImportCollection}
        onExportCollection={handleExportCollection}
        onExportEnvironment={handleExportEnvironment}
        onDeleteEnvironment={requestDeleteEnvironment}
        importExportLog={importExportLog}
        collections={collections}
        onAddCollection={handleAddCollection}
        onRenameCollection={handleRenameCollection}
        onDeleteCollection={handleDeleteCollection}
        onOpenCollectionRequest={handleOpenCollectionRequest}
        onAddFolder={handleAddFolder}
        onAddRequestNode={handleAddRequestNode}
        onRenameCollectionNode={handleRenameCollectionNode}
        onDeleteCollectionNode={handleDeleteCollectionNode}
        onMoveCollectionNode={handleMoveCollectionNode}
      />

      <main
        className={cn(
          "flex h-screen flex-col gap-5 overflow-hidden p-6 transition-[margin-left,margin-right] duration-150",
          sidebarOpen ? "ml-[max(16vw,180px)]" : "ml-0",
          variablesPanelOpen ? "mr-[max(16vw,280px)]" : "mr-0"
        )}
      >
      <div className="flex shrink-0 flex-col gap-3">
        <TabBar
          requests={requests}
          activeId={activeId}
          onSelectTab={setActiveId}
          onCloseTab={handleCloseTab}
          onAddTab={handleAddTab}
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
          onDeleteEnvironment={requestDeleteEnvironment}
          onExportEnvironment={handleExportEnvironment}
          onUpdateEnvironmentVariable={updateEnvironmentVariable}
          onRemoveEnvironmentVariable={removeEnvironmentVariable}
        />

        <RequestEditor
          key={activeRequest.id}
          activeRequest={activeRequest}
          onUpdate={updateActiveRequest}
          onCommitName={handleCommitRequestName}
          onUpdateMethod={handleUpdateMethod}
          onUrlChange={handleUrlChange}
          onSend={handleSend}
          canSend={canSend}
          urlError={urlError}
          unresolvedVariables={unresolvedVariables}
          onSaveInPlace={handleSaveActiveRequestInPlace}
          collections={collections}
          onAddCollection={handleAddCollection}
          onConfirmSaveTo={handleConfirmSaveTo}
          activeEnvironment={activeEnvironment}
          variableContext={variableContext}
          onUpdateEnvironmentVariable={updateActiveEnvironmentVariable}
          onOpenEnvironment={handleOpenEnvironment}
          onOpenVariablesPanel={handleOpenVariablesPanel}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <RequestVariablesTabs
          key={activeRequest.id}
          activeRequest={activeRequest}
          onUpdate={updateActiveRequest}
          updateParam={updateParam}
          removeParam={removeParam}
          updateHeader={updateHeader}
          removeHeader={removeHeader}
          onBodyKeyDown={handleBodyKeyDown}
          bodyError={bodyError}
          activeEnvironment={activeEnvironment}
          variableContext={variableContext}
          onUpdateEnvironmentVariable={updateActiveEnvironmentVariable}
          onOpenEnvironment={handleOpenEnvironment}
          onOpenVariablesPanel={handleOpenVariablesPanel}
        />

        <ResponseContainer error={activeRequest.error} response={activeRequest.response} />
      </div>
    </main>

    <VariablesPanel
      open={variablesPanelOpen}
      onClose={() => setVariablesPanelOpen(false)}
      onHandlePointerDown={handleVariablesPanelHandlePointerDown}
      variableNames={requestVariableNames}
      variableContext={variableContext}
      onUpdateVariable={updateActiveEnvironmentVariable}
      curlCommand={curlCommand}
    />
    </>
  );
}

export default App;
