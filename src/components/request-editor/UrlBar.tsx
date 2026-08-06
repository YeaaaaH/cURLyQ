import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Braces, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HTTP_METHODS, METHOD_COLORS } from "@/lib/http";
import type { Environment } from "@/lib/environments";
import type { VariableLookup } from "@/lib/variables";
import { VariableAwareInput } from "@/components/VariableAwareInput";

interface UrlBarProps {
  method: string;
  onMethodChange: (method: string) => void;
  url: string;
  onUrlChange: (url: string) => void;
  onSend: (e: React.FormEvent<HTMLFormElement>) => void;
  canSend: boolean;
  isSending: boolean;
  urlError: string | null;
  unresolvedVariables: string[];
  environment: Environment | null;
  variableContext: VariableLookup;
  onUpdateEnvironmentVariable: (name: string, value: string) => void;
  onCreateEnvironmentVariable: (name: string) => void;
  onOpenEnvironment: () => void;
  onOpenVariablesPanel: () => void;
}

export function UrlBar({
  method,
  onMethodChange,
  url,
  onUrlChange,
  onSend,
  canSend,
  isSending,
  urlError,
  unresolvedVariables,
  environment,
  variableContext,
  onUpdateEnvironmentVariable,
  onCreateEnvironmentVariable,
  onOpenEnvironment,
  onOpenVariablesPanel,
}: UrlBarProps) {
  return (
    <form className="flex flex-col gap-1.5" onSubmit={onSend}>
      <div className="flex gap-2">
        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger className={cn("w-28 font-semibold", METHOD_COLORS[method])}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m} className={cn("font-semibold", METHOD_COLORS[m])}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <VariableAwareInput
          className="font-mono"
          value={url}
          onChange={onUrlChange}
          environment={environment}
          variableContext={variableContext}
          onUpdateVariable={onUpdateEnvironmentVariable}
          onCreateVariable={onCreateEnvironmentVariable}
          onOpenEnvironment={onOpenEnvironment}
          onOpenVariablesPanel={onOpenVariablesPanel}
          placeholder="https://example.com"
          ariaInvalid={urlError !== null}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onOpenVariablesPanel}
          aria-label="Variables in request"
          className="shrink-0"
        >
          <Braces className="size-4" />
        </Button>
        <Button type="submit" className="w-24" disabled={isSending || !canSend}>
          {isSending && <Loader2 className="size-3.5 animate-spin" />}
          {isSending ? "Sending…" : "Send"}
        </Button>
      </div>
      {urlError && <p className="text-sm text-destructive">{urlError}</p>}
      {unresolvedVariables.length > 0 && (
        <p className="text-sm text-destructive">
          Unresolved variable{unresolvedVariables.length > 1 ? "s" : ""}:{" "}
          {unresolvedVariables.map((name) => `{{${name}}}`).join(", ")}
        </p>
      )}
    </form>
  );
}
