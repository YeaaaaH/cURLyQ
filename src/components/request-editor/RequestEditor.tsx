import { useEffect, useState } from "react";
import type { Collection } from "@/lib/collections";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";
import type { RequestTab } from "@/lib/requestTabs";
import { RequestNameBar } from "./RequestNameBar";
import { UrlBar } from "./UrlBar";
import { SaveRequestDialog } from "./SaveRequestDialog";

interface RequestEditorProps {
  activeRequest: RequestTab;
  onUpdate: (patch: Partial<RequestTab>) => void;
  onCommitName: () => void;
  onUpdateMethod: (method: string) => void;
  onUrlChange: (rawUrl: string) => void;
  onSend: (e: React.FormEvent<HTMLFormElement>) => void;
  canSend: boolean;
  urlError: string | null;
  unresolvedVariables: string[];
  onSaveInPlace: () => void;
  collections: readonly Collection[];
  onAddCollection: () => string;
  onConfirmSaveTo: (collectionId: string, parentFolderId: string | null, name: string) => void;
  activeEnvironment: Environment | null;
  variableContext: VariableLookup;
  onUpdateEnvironmentVariable: (name: string, value: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}

export function RequestEditor({
  activeRequest,
  onUpdate,
  onCommitName,
  onUpdateMethod,
  onUrlChange,
  onSend,
  canSend,
  urlError,
  unresolvedVariables,
  onSaveInPlace,
  collections,
  onAddCollection,
  onConfirmSaveTo,
  activeEnvironment,
  variableContext,
  onUpdateEnvironmentVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
}: RequestEditorProps) {
  // "Save as" always opens the picker, even for a tab that already has a
  // source — forking a copy rather than overwriting the linked request.
  // Purely local to this editor: nothing outside it needs to know whether
  // the picker is open.
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // The explicit Save gesture (Ctrl+S / Save button). A tab already linked
  // to a collection request updates that request in place; a fresh,
  // never-saved tab has nowhere to save *to* yet, so it opens the "Save
  // to..." picker instead.
  function handleSave() {
    if (!activeRequest.sourceRequestId || !activeRequest.sourceCollectionId) {
      setSaveDialogOpen(true);
      return;
    }
    onSaveInPlace();
  }

  function handleConfirmSaveTo(collectionId: string, parentFolderId: string | null, name: string) {
    onConfirmSaveTo(collectionId, parentFolderId, name);
    setSaveDialogOpen(false);
  }

  // Ctrl+S (Cmd+S on macOS) saves the active tab from anywhere in the
  // window, matching every other editor's muscle memory — without
  // preventDefault the browser's native "Save page" dialog would fire
  // instead. Registered here rather than in App.tsx since it's just the
  // keyboard path to the same handleSave this editor already owns, and this
  // component is always mounted whenever there's an active request.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "s" || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      handleSave();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <>
      <RequestNameBar
        name={activeRequest.name}
        onNameChange={(name) => onUpdate({ name })}
        onCommitName={onCommitName}
        onSave={handleSave}
        onSaveAs={() => setSaveDialogOpen(true)}
      />

      <UrlBar
        method={activeRequest.method}
        onMethodChange={onUpdateMethod}
        url={activeRequest.url}
        onUrlChange={onUrlChange}
        onSend={onSend}
        canSend={canSend}
        isSending={activeRequest.isSending}
        urlError={urlError}
        unresolvedVariables={unresolvedVariables}
        environment={activeEnvironment}
        variableContext={variableContext}
        onUpdateEnvironmentVariable={onUpdateEnvironmentVariable}
        onOpenEnvironment={onOpenEnvironment}
        onOpenVariablesPanel={onOpenVariablesPanel}
      />

      <SaveRequestDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        collections={collections}
        defaultName={activeRequest.name}
        onAddCollection={onAddCollection}
        onConfirm={handleConfirmSaveTo}
      />
    </>
  );
}
