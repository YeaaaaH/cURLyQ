import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { KeyValuePair } from "@/lib/keyValue";
import type { Environment } from "@/lib/environments";
import type { RequestTab } from "@/lib/requestTabs";
import { EnvironmentsEditorPopup } from "@/components/EnvironmentsEditorPopup";
import { RequestTabList } from "./RequestTabList";
import { EnvironmentSelector } from "./EnvironmentSelector";

interface TabBarProps {
  requests: readonly RequestTab[];
  activeId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
  environments: readonly Environment[];
  activeEnvironmentId: string | null;
  onSelectEnvironment: (id: string | null) => void;
  onEditEnvironment: (id: string) => void;
  environmentEditorOpen: boolean;
  onEnvironmentEditorOpenChange: (open: boolean) => void;
  editingEnvironmentId: string | null;
  onSelectEditingEnvironment: (id: string) => void;
  onAddEnvironment: () => void;
  onRenameEnvironment: (id: string, name: string) => void;
  onDeleteEnvironment: (id: string) => void;
  onExportEnvironment: (id: string) => void;
  onUpdateEnvironmentVariable: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemoveEnvironmentVariable: (index: number) => void;
}

export function TabBar({
  requests,
  activeId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onEditEnvironment,
  environmentEditorOpen,
  onEnvironmentEditorOpenChange,
  editingEnvironmentId,
  onSelectEditingEnvironment,
  onAddEnvironment,
  onRenameEnvironment,
  onDeleteEnvironment,
  onExportEnvironment,
  onUpdateEnvironmentVariable,
  onRemoveEnvironmentVariable,
}: TabBarProps) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-sidebar-border bg-sidebar px-5 py-3">
        <RequestTabList requests={requests} activeId={activeId} onSelectTab={onSelectTab} onCloseTab={onCloseTab} />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onAddTab}
          aria-label="New request tab"
          className="shrink-0"
        >
          <Plus />
        </Button>

        <EnvironmentSelector
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onSelectEnvironment={onSelectEnvironment}
          onEditEnvironment={onEditEnvironment}
        />
      </div>

      <EnvironmentsEditorPopup
        open={environmentEditorOpen}
        onOpenChange={onEnvironmentEditorOpenChange}
        environments={environments as Environment[]}
        editingId={editingEnvironmentId}
        onSelectEditing={onSelectEditingEnvironment}
        onAdd={onAddEnvironment}
        onRename={onRenameEnvironment}
        onDelete={onDeleteEnvironment}
        onExport={onExportEnvironment}
        onUpdateVariable={onUpdateEnvironmentVariable}
        onRemoveVariable={onRemoveEnvironmentVariable}
      />
    </>
  );
}
