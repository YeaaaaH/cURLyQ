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
  onCreateEnvironmentVariable: (name: string) => void;
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
  onCreateEnvironmentVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
}: RequestEditorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

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
        onCreateEnvironmentVariable={onCreateEnvironmentVariable}
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
