import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Trash2 } from "lucide-react";
import type { KeyValuePair } from "@/lib/keyValue";
import type { Environment } from "@/lib/environments";
import { EnvironmentEditor } from "@/components/EnvironmentEditor";

// The Dialog "popup" chrome (overlay, centering, the "Environments" title,
// the footer's Export/Delete/Done actions for whichever environment is
// currently selected, the built-in close button) around EnvironmentEditor,
// which is just the left-rail-plus-variables content shown inside it — split
// out so the popup itself has its own name instead of being anonymous JSX
// inline in TabBar.
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
      <DialogContent className="flex h-[75vh] w-[80vw] max-w-[80vw] flex-col sm:max-w-[80vw]">
        <DialogHeader>
          <DialogTitle>Environments</DialogTitle>
        </DialogHeader>
        <EnvironmentEditor
          environments={environments}
          editingId={editingId}
          onSelectEditing={onSelectEditing}
          onAdd={onAdd}
          onRename={onRename}
          onUpdateVariable={onUpdateVariable}
          onRemoveVariable={onRemoveVariable}
        />
        {editingId && (
          <DialogFooter>
            <div className="flex gap-2 sm:mr-auto">
              <Button type="button" variant="outline" onClick={() => onExport(editingId)} className="gap-1.5">
                <Download className="size-3.5" />
                Export
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onDelete(editingId)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete environment
              </Button>
            </div>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
