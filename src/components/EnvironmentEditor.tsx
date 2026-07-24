import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeyValuePair } from "@/lib/keyValue";
import type { Environment } from "@/lib/environments";
import { KeyValueEditor } from "@/components/KeyValueEditor";

// Local draft state, only committed to the shared `environments` state on
// explicit confirm (click or Enter) — typing here never touches the
// app-wide state, so it can't cascade a re-render into the sidebar,
// environment dropdown, or the rest of this editor on every keystroke.
// `key={id}` on the call site (not shown here) resets the draft whenever the
// user switches which environment they're editing.
function EnvironmentNameField({
  name,
  onConfirm,
}: {
  name: string;
  onConfirm: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  const isDirty = trimmed !== "" && trimmed !== name;

  function commit() {
    if (isDirty) onConfirm(trimmed);
    else setDraft(name);
  }

  return (
    <div className="flex flex-none items-center gap-1.5">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-auto min-w-32 max-w-full font-medium [field-sizing:content]"
        aria-label="Environment name"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={commit}
        disabled={!isDirty}
        aria-label="Confirm name change"
      >
        <Check className="size-3.5" />
      </Button>
    </div>
  );
}

export function EnvironmentEditor({
  environments,
  editingId,
  onSelectEditing,
  onAdd,
  onRename,
  onDelete,
  onUpdateVariable,
  onRemoveVariable,
}: {
  environments: Environment[];
  editingId: string | null;
  onSelectEditing: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onUpdateVariable: (index: number, patch: Partial<KeyValuePair>) => void;
  onRemoveVariable: (index: number) => void;
}) {
  const editing = environments.find((e) => e.id === editingId) ?? null;

  return (
    <div className="flex h-[75vh] gap-4">
      <div className="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-1 pr-3">
        {environments.map((env) => (
          <div
            key={env.id}
            className={cn(
              "group/env-row flex shrink-0 items-center rounded-md",
              env.id === editingId && "bg-secondary"
            )}
          >
            <button
              type="button"
              onClick={() => onSelectEditing(env.id)}
              className={cn(
                "min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm",
                env.id === editingId ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {env.name}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${env.name} options`}
                  className="mr-0.5 shrink-0 text-muted-foreground opacity-0 group-hover/env-row:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(env.id)}>
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="mt-1 shrink-0 justify-start gap-1.5 text-muted-foreground"
        >
          <Plus className="size-3.5" />
          New environment
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-1">
        {editing ? (
          <>
            <EnvironmentNameField
              key={editing.id}
              name={editing.name}
              onConfirm={(name) => onRename(editing.id, name)}
            />
            <KeyValueEditor
              rows={editing.variables}
              onUpdate={onUpdateVariable}
              onRemove={onRemoveVariable}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No environments yet. Create one to define variables like{" "}
            <code className="font-mono">baseUrl</code>.
          </p>
        )}
      </div>
    </div>
  );
}
