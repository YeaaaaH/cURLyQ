import { useCallback, useEffect, useState } from "react";
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
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TabBar } from "@/components/tab-bar/TabBar";
import { RequestEditor } from "@/components/request-editor/RequestEditor";
import { VariablesPanel } from "@/components/variables-panel/VariablesPanel";
import { RequestVariablesTabs } from "@/components/request-variables-tabs/RequestVariablesTabs";
import { ResponseContainer } from "@/components/response-container/ResponseContainer";
import { useEdgeDragPanel } from "@/hooks/useEdgeDragPanel";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useCollections } from "@/hooks/useCollections";
import { useRequestTabs } from "@/hooks/useRequestTabs";

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

  // A drag-to-open sidebar/variables-panel (rather than a click toggle) for
  // browsing many environments/collections or a long variables list at once.
  // Matches Postman's feel: a short pull past a small threshold snaps
  // straight open, and pulling back the other way snaps it shut.
  const sidebarPanel = useEdgeDragPanel("left");
  const variablesPanel = useEdgeDragPanel("right");

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
      <Toaster position="bottom-right" richColors />
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
      <Sidebar
        sidebarOpen={sidebarPanel.open}
        onHandlePointerDown={sidebarPanel.onHandlePointerDown}
        environments={environments.environments}
        activeEnvironmentId={environments.activeEnvironmentId}
        onSelectEnvironment={environments.setActiveEnvironmentId}
        onEditEnvironment={environments.openEnvironmentEditor}
        onAddEnvironment={environments.handleAddEnvironment}
        onImportEnvironment={environments.handleImportEnvironment}
        onImportCollection={collectionsApi.handleImportCollection}
        onExportCollection={collectionsApi.handleExportCollection}
        onExportEnvironment={environments.handleExportEnvironment}
        onDeleteEnvironment={environments.requestDeleteEnvironment}
        importExportLog={importExportLog}
        collections={collections}
        onAddCollection={collectionsApi.handleAddCollection}
        onRenameCollection={collectionsApi.handleRenameCollection}
        onDeleteCollection={collectionsApi.handleDeleteCollection}
        onOpenCollectionRequest={tabs.handleOpenCollectionRequest}
        onAddFolder={collectionsApi.handleAddFolder}
        onAddRequestNode={collectionsApi.handleAddRequestNode}
        onRenameCollectionNode={collectionsApi.handleRenameCollectionNode}
        onDeleteCollectionNode={collectionsApi.handleDeleteCollectionNode}
        onMoveCollectionNode={collectionsApi.handleMoveCollectionNode}
      />

      <main
        className={cn(
          "flex h-screen flex-col gap-5 overflow-hidden p-6 transition-[margin-left,margin-right] duration-150",
          sidebarPanel.open ? "ml-[max(16vw,180px)]" : "ml-0",
          variablesPanel.open ? "mr-[max(16vw,280px)]" : "mr-0"
        )}
      >
      <div className="flex shrink-0 flex-col gap-3">
        <TabBar
          requests={tabs.requests}
          activeId={tabs.activeId}
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
