import type { KeyValuePair } from "@/lib/keyValue";
import type { RequestTab } from "@/lib/requestTabs";
import { KeyValueEditor } from "@/components/KeyValueEditor";

export function RequestPanel({
  activeRequest,
  onUpdate,
  updateParam,
  removeParam,
  updateHeader,
  removeHeader,
  onBodyKeyDown,
  bodyError,
}: {
  activeRequest: RequestTab;
  onUpdate: (patch: Partial<RequestTab>) => void;
  updateParam: (index: number, patch: Partial<KeyValuePair>) => void;
  removeParam: (index: number) => void;
  updateHeader: (index: number, patch: Partial<KeyValuePair>) => void;
  removeHeader: (index: number) => void;
  onBodyKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  bodyError: string | null;
}) {
  return (
    <div className="scrollbar-thin h-[340px] shrink-0 overflow-y-auto rounded-lg border border-input p-3 text-sm text-muted-foreground">
      {activeRequest.activeSubTab === "params" && (
        <KeyValueEditor rows={activeRequest.params} onUpdate={updateParam} onRemove={removeParam} />
      )}
      {activeRequest.activeSubTab === "headers" && (
        <KeyValueEditor rows={activeRequest.headers} onUpdate={updateHeader} onRemove={removeHeader} />
      )}
      {activeRequest.activeSubTab === "body" && (
        <div className="flex h-full min-h-0 flex-col gap-1.5">
          <textarea
            className="scrollbar-thin min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-md bg-muted/60 p-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:ring-2 aria-invalid:ring-destructive"
            placeholder={`{\n  "name": "Ada Lovelace",\n  "role": "engineer",\n  "tags": ["math", "computing"]\n}`}
            value={activeRequest.body}
            onChange={(e) => onUpdate({ body: e.target.value })}
            onKeyDown={onBodyKeyDown}
            onMouseDown={(e) => {
              if (e.detail < 3) return;
              e.preventDefault();
              e.currentTarget.select();
            }}
            aria-invalid={bodyError !== null}
            spellCheck={false}
          />
          {bodyError && <p className="text-sm text-destructive">{bodyError}</p>}
        </div>
      )}
    </div>
  );
}
