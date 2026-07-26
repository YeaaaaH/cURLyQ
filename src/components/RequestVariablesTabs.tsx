import { Card } from "@/components/ui/card";
import type { KeyValuePair } from "@/lib/keyValue";
import { DEFAULT_HEADERS } from "@/lib/http";
import type { RequestTab } from "@/lib/requestTabs";
import { KeyValueEditor } from "@/components/KeyValueEditor";

// Which of DEFAULT_HEADERS aren't already covered by one of the user's own
// header rows (case-insensitive, non-empty key) — those are shown as locked
// rows; a header the user set explicitly always wins instead of doubling up.
function unmatchedDefaultHeaders(headers: KeyValuePair[]) {
  return DEFAULT_HEADERS.filter(
    (def) => !headers.some((h) => h.key.trim().toLowerCase() === def.key.toLowerCase())
  );
}

export function RequestVariablesTabs({
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
    <Card className="scrollbar-thin h-[340px] shrink-0 overflow-y-auto rounded-lg border border-input p-3 text-sm text-muted-foreground ring-0">
      {activeRequest.activeSubTab === "params" && (
        <KeyValueEditor rows={activeRequest.params} onUpdate={updateParam} onRemove={removeParam} />
      )}
      {activeRequest.activeSubTab === "headers" && (
        <KeyValueEditor
          rows={activeRequest.headers}
          onUpdate={updateHeader}
          onRemove={removeHeader}
          lockedRows={unmatchedDefaultHeaders(activeRequest.headers)}
        />
      )}
      {activeRequest.activeSubTab === "body" && (
        <div className="flex h-full min-h-0 flex-col gap-1.5">
          <textarea
            className="scrollbar-thin min-h-0 w-full flex-1 resize-none overflow-y-auto font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/70 aria-invalid:ring-2 aria-invalid:ring-destructive"
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
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {bodyError && <p className="text-sm text-destructive">{bodyError}</p>}
        </div>
      )}
    </Card>
  );
}
