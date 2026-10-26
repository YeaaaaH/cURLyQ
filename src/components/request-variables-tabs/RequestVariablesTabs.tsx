import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { KeyValuePair } from "@/lib/keyValue";
import { DEFAULT_HEADERS } from "@/lib/http";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";
import { type RequestTab, type ScriptsSubTab, formatJsonBody } from "@/lib/requestTabs";
import { KeyValueEditor } from "@/components/KeyValueEditor";
import { VariableAwareTextarea } from "@/components/VariableAwareTextarea";
import type { ScriptHalf } from "@/lib/scripting/types";
import { SubTabSwitcher } from "./SubTabSwitcher";
import { ScriptsTab } from "./scripts/ScriptsTab";

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
  bodyError: string | null;
  activeEnvironment: Environment | null;
  variableContext: VariableLookup;
  onUpdateEnvironmentVariable: (name: string, value: string) => void;
  onCreateEnvironmentVariable: (name: string) => void;
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
  bodyError,
  activeEnvironment,
  variableContext,
  onUpdateEnvironmentVariable,
  onCreateEnvironmentVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
}: RequestVariablesTabsProps) {
  const variableAware = {
    environment: activeEnvironment,
    variableContext,
    onUpdateVariable: onUpdateEnvironmentVariable,
    onCreateVariable: onCreateEnvironmentVariable,
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
              placeholder={`{ "name": "Ada Lovelace", "role": "engineer" }`}
              value={activeRequest.body}
              onChange={(value) => onUpdate({ body: value })}
              ariaInvalid={bodyError !== null}
              environment={variableAware.environment}
              variableContext={variableAware.variableContext}
              onUpdateVariable={variableAware.onUpdateVariable}
              onCreateVariable={variableAware.onCreateVariable}
              onOpenEnvironment={variableAware.onOpenEnvironment}
              onOpenVariablesPanel={variableAware.onOpenVariablesPanel}
            />
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="text-sm text-destructive">{bodyError}</p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={bodyError !== null || activeRequest.body.trim() === ""}
                onClick={() => onUpdate({ body: formatJsonBody(activeRequest.body) })}
                title={bodyError ?? "Format JSON"}
              >
                <WandSparkles />
                Beautify
              </Button>
            </div>
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
