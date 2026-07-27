import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { KeyValuePair } from "@/lib/keyValue";
import type { Environment } from "@/lib/environments";
import { EnvironmentEditor } from "@/components/EnvironmentEditor";

// The Dialog "popup" chrome (overlay, centering, the "Environments" title,
// the built-in close button) around EnvironmentEditor, which is just the
// content shown inside it — split out so the popup itself has its own name
// instead of being anonymous JSX inline in TabBar.
export function EnvironmentsEditorPopup({
  open,
  onOpenChange,
  environments,
  editingId,
  onSelectEditing,
  onAdd,
  onRename,
  onDelete,
  onExport,
  onUpdateVariable,
  onRemoveVariable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environments: Environment[];
  editingId: string | null;
  onSelectEditing: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onUpdateVariable: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemoveVariable: (index: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw]">
        <DialogHeader>
          <DialogTitle>Environments</DialogTitle>
        </DialogHeader>
        <EnvironmentEditor
          environments={environments}
          editingId={editingId}
          onSelectEditing={onSelectEditing}
          onAdd={onAdd}
          onRename={onRename}
          onDelete={onDelete}
          onExport={onExport}
          onUpdateVariable={onUpdateVariable}
          onRemoveVariable={onRemoveVariable}
        />
      </DialogContent>
    </Dialog>
  );
}
