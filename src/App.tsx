import { useCallback, useEffect, useMemo, useState } from "react";
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
import { type ImportExportLogEntry, pushLogEntry } from "@/lib/importExportLog";
import type { Collection } from "@/lib/collections";
import { isRequestTabDirty } from "@/lib/requestTabs";
import { TitleBar } from "@/components/title-bar/TitleBar";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TabBar } from "@/components/tab-bar/TabBar";
import { RequestEditor } from "@/components/request-editor/RequestEditor";
import { VariablesPanel } from "@/components/variables-panel/VariablesPanel";
import { RequestVariablesTabs } from "@/components/request-variables-tabs/RequestVariablesTabs";
import { ResponseContainer } from "@/components/response-container/ResponseContainer";
import { RunResultsView } from "@/components/run-results/RunResultsView";
import { useEdgeDragPanel } from "@/hooks/useEdgeDragPanel";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useCollections } from "@/hooks/useCollections";
import { useRequestTabs } from "@/hooks/useRequestTabs";
import { useCollectionRun } from "@/hooks/useCollectionRun";

function App() {
  const [importExportLog, setImportExportLog] = useState<ImportExportLogEntry[]>([]);
  // Wrapped in useCallback (stable, since setImportExportLog is a React
  // setState setter and pushLogEntry is a pure import — no other deps) so
  // this stays a stable prop for useEnvironments/useCollections' handlers,
  // which are in turn passed down to the React.memo'd Sidebar.
  const onLogEntry = useCallback((entry: Omit<ImportExportLogEntry, "id" | "timestamp">) => {
    setImportExportLog((prev) => pushLogEntry(prev, entry));
  }, []);

  const environments = useEnvironments({ onLogEntry });

  // Lives here (rather than inside useCollections) because both useCollections
  // and useRequestTabs need it: request tabs write into collections (rename,
  // save-in-place, save-as), and collections need to close tabs for deleted
  // requests — a genuine two-way dependency between the two domains.
  const [collections, setCollections] = useState<Collection[]>([]);

  const tabs = useRequestTabs({
    variableContext: environments.variableContext,
    activeEnvironment: environments.activeEnvironment,
    applyEnvironmentPatch: environments.applyEnvironmentPatch,
    setCollections,
  });

  const collectionsApi = useCollections({
    collections,
    setCollections,
    closeTabsForRequestIds: tabs.closeTabsForRequestIds,
    openCollectionRequestTab: tabs.openCollectionRequestTab,
    onLogEntry,
  });

  const collectionRun = useCollectionRun({
    collections,
    variableContext: environments.variableContext,
    activeEnvironment: environments.activeEnvironment,
    applyEnvironmentPatch: environments.applyEnvironmentPatch,
    addRunResultTab: tabs.addRunResultTab,
  });

  // Which open tabs have content that isn't actually persisted — url/params/
  // headers/body/scripts only get written back to a linked collection
  // request on an explicit Save (unlike name/method, which sync live), so a
  // tab can look right on screen while what's saved (and what Collection Run
  // would execute) is stale or, for a never-saved tab, nonexistent.
  const dirtyTabIds = useMemo(
    () => new Set(tabs.requests.filter((r) => isRequestTabDirty(r, collections)).map((r) => r.id)),
    [tabs.requests, collections]
  );

  // A drag-to-open sidebar/variables-panel (rather than a click toggle) for
  // browsing many environments/collections or a long variables list at once.
  // Matches Postman's feel: a short pull past a small threshold snaps
  // straight open, and pulling back the other way snaps it shut.
  const sidebarPanel = useEdgeDragPanel("left");
  const variablesPanel = useEdgeDragPanel("right");

  // Explicit collapse button in the sidebar header, in addition to the
  // edge-drag handle — stable identity for the memoized Sidebar, same
  // treatment as the rest of its callback props.
  const onCollapseSidebar = useCallback(() => sidebarPanel.setOpen(false), [sidebarPanel.setOpen]);

  // Keyboard equivalent of the edge handle's drag-to-snap gesture — the
  // handle isn't a continuous resizer (the sidebar's width is fixed; the
  // drag only decides open vs. closed past a threshold), so this toggles
  // rather than resizing.
  const onToggleSidebar = useCallback(() => sidebarPanel.setOpen((open) => !open), [sidebarPanel.setOpen]);

  // Grouped so Sidebar takes one collections-domain prop instead of eleven —
  // memoized here (not just relying on each field being individually stable)
  // because an inline object literal would itself be a new identity every
  // render, which would defeat Sidebar's React.memo just as surely as an
  // un-memoized callback would.
  const collectionsProps = useMemo(
    () => ({
      collections,
      onAddCollection: collectionsApi.handleAddCollection,
      onImportCollection: collectionsApi.handleImportCollection,
      onExportCollection: collectionsApi.handleExportCollection,
      onRenameCollection: collectionsApi.handleRenameCollection,
      onDeleteCollection: collectionsApi.handleDeleteCollection,
      onRunCollection: collectionRun.handleRunCollection,
      onOpenCollectionRequest: tabs.handleOpenCollectionRequest,
      onAddFolder: collectionsApi.handleAddFolder,
      onAddRequestNode: collectionsApi.handleAddRequestNode,
      onRunCollectionNode: collectionRun.handleRunNode,
      onRenameCollectionNode: collectionsApi.handleRenameCollectionNode,
      onDeleteCollectionNode: collectionsApi.handleDeleteCollectionNode,
      onMoveCollectionNode: collectionsApi.handleMoveCollectionNode,
    }),
    [
      collections,
      collectionsApi.handleAddCollection,
      collectionsApi.handleImportCollection,
      collectionsApi.handleExportCollection,
      collectionsApi.handleRenameCollection,
      collectionsApi.handleDeleteCollection,
      collectionRun.handleRunCollection,
      tabs.handleOpenCollectionRequest,
      collectionsApi.handleAddFolder,
      collectionsApi.handleAddRequestNode,
      collectionRun.handleRunNode,
      collectionsApi.handleRenameCollectionNode,
      collectionsApi.handleDeleteCollectionNode,
      collectionsApi.handleMoveCollectionNode,
    ]
  );

  const environmentsProps = useMemo(
    () => ({
      environments: environments.environments,
      activeEnvironmentId: environments.activeEnvironmentId,
      onSelectEnvironment: environments.setActiveEnvironmentId,
      onEditEnvironment: environments.openEnvironmentEditor,
      onAddEnvironment: environments.handleAddEnvironment,
      onImportEnvironment: environments.handleImportEnvironment,
      onExportEnvironment: environments.handleExportEnvironment,
      onDeleteEnvironment: environments.requestDeleteEnvironment,
    }),
    [
      environments.environments,
      environments.activeEnvironmentId,
      environments.setActiveEnvironmentId,
      environments.openEnvironmentEditor,
      environments.handleAddEnvironment,
      environments.handleImportEnvironment,
      environments.handleExportEnvironment,
      environments.requestDeleteEnvironment,
    ]
  );

  // A live-resizing window with a docked panel open looks jarring (text
  // rewrapping, the cURL block reflowing) — simplest is to just close
  // whichever panel is open rather than trying to animate through it.
  useEffect(() => {
    function handleWindowResize() {
      sidebarPanel.setOpen(false);
      variablesPanel.setOpen(false);
    }
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [sidebarPanel, variablesPanel]);

  // Always resolves to a real tab — `activeId` only ever points at something
  // currently in `allTabs` (both request and run-result tab close/select
  // logic keep that invariant).
  const activeTab = tabs.allTabs.find((t) => t.id === tabs.activeId)!;

  // Shared by every variable-aware field (URL, and header/param values) so
  // each one jumps to the same place instead of each needing its own inline
  // closure.
  function handleOpenEnvironment() {
    if (environments.activeEnvironmentId) environments.openEnvironmentEditor(environments.activeEnvironmentId);
  }
  function handleOpenVariablesPanel() {
    variablesPanel.setOpen(true);
  }

  const pendingDeleteVariableCount =
    environments.pendingDeleteEnvironment?.variables.filter((v) => v.key.trim() !== "").length ?? 0;

  return (
    <>
      <Toaster position="bottom-right" />
      <AlertDialog
        open={environments.pendingDeleteEnvironment !== null}
        onOpenChange={(open) => !open && environments.cancelDeleteEnvironment()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{environments.pendingDeleteEnvironment?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This environment has {pendingDeleteVariableCount} variable
              {pendingDeleteVariableCount === 1 ? "" : "s"}. Deleting it can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={environments.confirmDeleteEnvironment}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TitleBar />

      <Sidebar
        sidebarOpen={sidebarPanel.open}
        onHandlePointerDown={sidebarPanel.onHandlePointerDown}
        onToggleSidebar={onToggleSidebar}
        onCollapseSidebar={onCollapseSidebar}
        importExportLog={importExportLog}
        collectionsProps={collectionsProps}
        environmentsProps={environmentsProps}
      />

      <main
        className={cn(
          "mt-8 flex h-[calc(100vh-2rem)] flex-col overflow-hidden transition-[margin-left,margin-right] duration-150",
          sidebarPanel.open ? "ml-[max(16vw,180px)]" : "ml-0",
          variablesPanel.open ? "mr-[max(16vw,280px)]" : "mr-0"
        )}
      >
        <TabBar
          tabs={tabs.allTabs}
          activeId={tabs.activeId}
          dirtyTabIds={dirtyTabIds}
          onSelectTab={tabs.setActiveId}
          onCloseTab={tabs.handleCloseTab}
          onAddTab={tabs.handleAddTab}
          environments={environments.environments}
          activeEnvironmentId={environments.activeEnvironmentId}
          onSelectEnvironment={environments.setActiveEnvironmentId}
          onEditEnvironment={environments.openEnvironmentEditor}
          environmentEditorOpen={environments.environmentEditorOpen}
          onEnvironmentEditorOpenChange={environments.setEnvironmentEditorOpen}
          editingEnvironmentId={environments.editingEnvironmentId}
          onSelectEditingEnvironment={environments.setEditingEnvironmentId}
          onAddEnvironment={environments.handleAddEnvironment}
          onRenameEnvironment={environments.handleRenameEnvironment}
          onDeleteEnvironment={environments.requestDeleteEnvironment}
          onExportEnvironment={environments.handleExportEnvironment}
          onUpdateEnvironmentVariable={environments.updateEnvironmentVariable}
          onRemoveEnvironmentVariable={environments.removeEnvironmentVariable}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-6">
          {activeTab.type === "run-result" ? (
            <RunResultsView tab={activeTab} />
          ) : (
            <>
              <div className="flex shrink-0 flex-col gap-3">
                <RequestEditor
                  key={tabs.activeRequest.id}
                  activeRequest={tabs.activeRequest}
                  onUpdate={tabs.updateActiveRequest}
                  onCommitName={tabs.handleCommitRequestName}
                  onUpdateMethod={tabs.handleUpdateMethod}
                  onUrlChange={tabs.handleUrlChange}
                  onSend={tabs.handleSend}
                  canSend={tabs.canSend}
                  urlError={tabs.urlError}
                  unresolvedVariables={tabs.unresolvedVariables}
                  onSaveInPlace={tabs.handleSaveActiveRequestInPlace}
                  collections={collections}
                  onAddCollection={collectionsApi.handleAddCollection}
                  onConfirmSaveTo={tabs.handleConfirmSaveTo}
                  activeEnvironment={environments.activeEnvironment}
                  variableContext={environments.variableContext}
                  onUpdateEnvironmentVariable={environments.updateActiveEnvironmentVariable}
                  onOpenEnvironment={handleOpenEnvironment}
                  onOpenVariablesPanel={handleOpenVariablesPanel}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-5">
                <RequestVariablesTabs
                  key={tabs.activeRequest.id}
                  activeRequest={tabs.activeRequest}
                  onUpdate={tabs.updateActiveRequest}
                  updateParam={tabs.updateParam}
                  removeParam={tabs.removeParam}
                  updateHeader={tabs.updateHeader}
                  removeHeader={tabs.removeHeader}
                  onBodyKeyDown={tabs.handleBodyKeyDown}
                  bodyError={tabs.bodyError}
                  activeEnvironment={environments.activeEnvironment}
                  variableContext={environments.variableContext}
                  onUpdateEnvironmentVariable={environments.updateActiveEnvironmentVariable}
                  onOpenEnvironment={handleOpenEnvironment}
                  onOpenVariablesPanel={handleOpenVariablesPanel}
                />

                <ResponseContainer error={tabs.activeRequest.error} response={tabs.activeRequest.response} />
              </div>
            </>
          )}
        </div>
      </main>

    <VariablesPanel
      open={variablesPanel.open}
      onClose={() => variablesPanel.setOpen(false)}
      onHandlePointerDown={variablesPanel.onHandlePointerDown}
      variableNames={tabs.requestVariableNames}
      variableContext={environments.variableContext}
      onUpdateVariable={environments.updateActiveEnvironmentVariable}
      curlCommand={tabs.curlCommand}
    />
    </>
  );
}

export default App;
