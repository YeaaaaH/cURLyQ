import { cn } from "@/lib/utils";
import type { ScriptHalf } from "@/lib/scripting/types";
import type { LastScriptRun, ScriptsSubTab } from "@/lib/requestTabs";
import { ScriptEditor, type ScriptSnippet } from "./ScriptEditor";
import { ScriptLogsPanel } from "./ScriptLogsPanel";

interface ScriptsTabProps {
  preRequestScript: string;
  postResponseScript: string;
  activeScriptTab: ScriptsSubTab;
  lastScriptRun: LastScriptRun;
  onChangeScript: (half: ScriptHalf, value: string) => void;
  onSelectScriptTab: (tab: ScriptsSubTab) => void;
}

const TABS: { id: ScriptsSubTab; label: string }[] = [
  { id: "pre-request", label: "Pre-request" },
  { id: "post-response", label: "Post-response" },
  { id: "logs", label: "Logs" },
];

const PLACEHOLDERS: Record<ScriptHalf, string> = {
  "pre-request": `pm.environment.set("timestamp", Date.now().toString());`,
  "post-response": `pm.environment.set("token", pm.response.json().token);`,
};

// Quick-insert buttons use `pm.`-prefixed, Postman-shaped calls (not just
// the identifier — `.upsert`/`.raw` too, see sandbox.worker.ts) so a script
// built entirely from these buttons is portable to real Postman by default,
// not just re-importable into cURLyQ. `ctx.*`/`.set()` still work identically
// (see sandbox.worker.ts's aliases) for anyone typing by hand who doesn't
// care about portability — this only changes what the buttons insert.
const SNIPPETS: Record<ScriptHalf, ScriptSnippet[]> = {
  "pre-request": [
    { label: "environment.get", insert: 'pm.environment.get("key")' },
    { label: "environment.set", insert: 'pm.environment.set("key", "value");' },
    { label: "request.headers.upsert", insert: 'pm.request.headers.upsert({ key: "Header-Name", value: "value" });' },
    { label: "request.body.raw", insert: "pm.request.body.raw = JSON.stringify(payload);" },
  ],
  "post-response": [
    { label: "environment.get", insert: 'pm.environment.get("key")' },
    { label: "environment.set", insert: 'pm.environment.set("key", "value");' },
    { label: "response.code", insert: "pm.response.code" },
    { label: "response.json()", insert: "pm.response.json()" },
  ],
};

export function ScriptsTab({
  preRequestScript,
  postResponseScript,
  activeScriptTab,
  lastScriptRun,
  onChangeScript,
  onSelectScriptTab,
}: ScriptsTabProps) {
  const hasFailure = lastScriptRun.pre?.error != null || lastScriptRun.post?.error != null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex w-fit shrink-0 gap-1 rounded-lg bg-secondary p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectScriptTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeScriptTab === tab.id
                ? "border border-input bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.id === "logs" && hasFailure && (
              <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-label="A script failed" />
            )}
          </button>
        ))}
      </div>
      {activeScriptTab === "logs" ? (
        <ScriptLogsPanel lastScriptRun={lastScriptRun} />
      ) : (
        <ScriptEditor
          value={activeScriptTab === "pre-request" ? preRequestScript : postResponseScript}
          onChange={(value) => onChangeScript(activeScriptTab, value)}
          placeholder={PLACEHOLDERS[activeScriptTab]}
          snippets={SNIPPETS[activeScriptTab]}
        />
      )}
    </div>
  );
}
