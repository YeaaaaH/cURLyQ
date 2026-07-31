import { Card } from "@/components/ui/card";
import type { KeyValuePair } from "@/lib/keyValue";
import { DEFAULT_HEADERS } from "@/lib/http";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";
import type { RequestTab, ScriptsSubTab } from "@/lib/requestTabs";
import { KeyValueEditor } from "@/components/KeyValueEditor";
import { VariableAwareTextarea } from "@/components/VariableAwareTextarea";
import type { ScriptHalf } from "@/lib/scripting/types";
import { SubTabSwitcher } from "./SubTabSwitcher";
import { ScriptsTab } from "./scripts/ScriptsTab";

// Which of DEFAULT_HEADERS aren't already covered by one of the user's own
// header rows (case-insensitive, non-empty key) — those are shown as locked
// rows; a header the user set explicitly always wins instead of doubling up.
function unmatchedDefaultHeaders(headers: KeyValuePair[]) {
  return DEFAULT_HEADERS.filter(
    (def) => !headers.some((h) => h.key.trim().toLowerCase() === def.key.toLowerCase())
  );
}

interface RequestVariablesTabsProps {
  activeRequest: RequestTab;
  onUpdate: (patch: Partial<RequestTab>) => void;
  updateParam: (index: number, patch: Partial<KeyValuePair>) => void;
  removeParam: (index: number) => void;
  updateHeader: (index: number, patch: Partial<KeyValuePair>) => void;
  removeHeader: (index: number) => void;
  onBodyKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  bodyError: string | null;
  activeEnvironment: Environment | null;
  variableContext: VariableLookup;
  onUpdateEnvironmentVariable: (name: string, value: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
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
  activeEnvironment,
  variableContext,
  onUpdateEnvironmentVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
}: RequestVariablesTabsProps) {
  const variableAware = {
    environment: activeEnvironment,
    variableContext,
    onUpdateVariable: onUpdateEnvironmentVariable,
    onOpenEnvironment,
    onOpenVariablesPanel,
  };

  return (
    <>
      <SubTabSwitcher
        activeSubTab={activeRequest.activeSubTab}
        onSelectSubTab={(tab) => onUpdate({ activeSubTab: tab })}
      />

      <Card className="scrollbar-thin h-[340px] shrink-0 overflow-y-auto border border-input p-3 text-sm text-muted-foreground ring-0">
        {activeRequest.activeSubTab === "params" && (
          <KeyValueEditor
            rows={activeRequest.params}
            onUpdate={updateParam}
            onRemove={removeParam}
            variableAware={variableAware}
            itemLabel="param"
          />
        )}
        {activeRequest.activeSubTab === "headers" && (
          <KeyValueEditor
            rows={activeRequest.headers}
            onUpdate={updateHeader}
            onRemove={removeHeader}
            lockedRows={unmatchedDefaultHeaders(activeRequest.headers)}
            variableAware={variableAware}
            itemLabel="header"
          />
        )}
        {activeRequest.activeSubTab === "body" && (
          <div className="flex h-full min-h-0 flex-col gap-1.5">
            <VariableAwareTextarea
              className="font-mono text-sm"
              placeholder={`{\n  "name": "Ada Lovelace",\n  "role": "engineer",\n  "tags": ["math", "computing"]\n}`}
              value={activeRequest.body}
              onChange={(value) => onUpdate({ body: value })}
              onKeyDown={onBodyKeyDown}
              ariaInvalid={bodyError !== null}
              environment={variableAware.environment}
              variableContext={variableAware.variableContext}
              onUpdateVariable={variableAware.onUpdateVariable}
              onOpenEnvironment={variableAware.onOpenEnvironment}
              onOpenVariablesPanel={variableAware.onOpenVariablesPanel}
            />
            {bodyError && <p className="text-sm text-destructive">{bodyError}</p>}
          </div>
        )}
        {activeRequest.activeSubTab === "scripts" && (
          <ScriptsTab
            preRequestScript={activeRequest.preRequestScript}
            postResponseScript={activeRequest.postResponseScript}
            activeScriptTab={activeRequest.activeScriptTab}
            lastScriptRun={activeRequest.lastScriptRun}
            onChangeScript={(half: ScriptHalf, value: string) =>
              onUpdate(half === "pre-request" ? { preRequestScript: value } : { postResponseScript: value })
            }
            onSelectScriptTab={(tab: ScriptsSubTab) => onUpdate({ activeScriptTab: tab })}
          />
        )}
      </Card>
    </>
  );
}
