import { cn } from "@/lib/utils";
import type { ScriptHalf } from "@/lib/scripting/types";
import type { LastScriptRun, ScriptsSubTab } from "@/lib/requestTabs";
import { ScriptEditor } from "./ScriptEditor";
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
  "pre-request": `// Runs before the request is sent\nctx.environment.set("timestamp", Date.now().toString());`,
  "post-response": `// Runs after the response arrives\nctx.environment.set("token", ctx.response.json().token);`,
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
        />
      )}
    </div>
  );
}
