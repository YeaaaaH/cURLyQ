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
  const onLogEntry = useCallback((entry: Omit<ImportExportLogEntry, "id" | "timestamp">) => {
    setImportExportLog((prev) => pushLogEntry(prev, entry));
  }, []);

  const environments = useEnvironments({ onLogEntry });

  // Here, not in useCollections: collections and tabs depend on each other.
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

  const dirtyTabIds = useMemo(
    () => new Set(tabs.requests.filter((r) => isRequestTabDirty(r, collections)).map((r) => r.id)),
    [tabs.requests, collections]
  );

  const sidebarPanel = useEdgeDragPanel("left");
  const variablesPanel = useEdgeDragPanel("right");

  const onCollapseSidebar = useCallback(() => sidebarPanel.setOpen(false), [sidebarPanel.setOpen]);

  const onToggleSidebar = useCallback(() => sidebarPanel.setOpen((open) => !open), [sidebarPanel.setOpen]);

  // Memoized as a whole: a fresh object literal would defeat Sidebar's React.memo.
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
      runningId: collectionRun.runningId,
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
      collectionRun.runningId,
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

  // Close the docked panel on resize instead of letting its content reflow.
  useEffect(() => {
    function handleWindowResize() {
      sidebarPanel.setOpen(false);
      variablesPanel.setOpen(false);
    }
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [sidebarPanel, variablesPanel]);

  const activeTab = tabs.allTabs.find((t) => t.id === tabs.activeId)!;

  function handleOpenEnvironment() {
    if (environments.activeEnvironmentId) environments.openEnvironmentEditor(environments.activeEnvironmentId);
  }
  function handleCreateEnvironmentVariable(name: string) {
    environments.applyEnvironmentPatch({ [name]: "" });
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
                  onCreateEnvironmentVariable={handleCreateEnvironmentVariable}
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
                  bodyError={tabs.bodyError}
                  activeEnvironment={environments.activeEnvironment}
                  variableContext={environments.variableContext}
                  onUpdateEnvironmentVariable={environments.updateActiveEnvironmentVariable}
                  onCreateEnvironmentVariable={handleCreateEnvironmentVariable}
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
