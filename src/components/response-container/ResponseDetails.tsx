import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { formatBody, formatDuration, formatSize, statusVariant } from "@/lib/requestTabs";
import type { HttpResponse } from "@/lib/http";

interface ResponseDetailsProps {
  response: HttpResponse;
}

export function ResponseDetails({ response }: ResponseDetailsProps) {
  const body = formatBody(response.body);
  const headersText = response.headers.map(([name, value]) => `${name}: ${value}`).join("\n");
  const contentType = response.headers.find(([name]) => name.toLowerCase() === "content-type")?.[1];

  const statusBadge = (
    <span className="flex items-center gap-2">
      <Badge variant={statusVariant(response.status)} className="font-mono text-sm">
        {response.status}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">{formatDuration(response.timeMs)}</span>
      <span className="font-mono text-xs text-muted-foreground">{formatSize(response.sizeBytes)}</span>
    </span>
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 border border-input py-0 ring-0">
      {response.headers.length > 0 ? (
        <Collapsible className="shrink-0 border-b">
          <div className="flex items-center pr-2">
            <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                {statusBadge}
                Response Headers ({response.headers.length})
              </span>
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CopyButton text={headersText} label="Copy response headers" />
          </div>
          <CollapsibleContent className="scrollbar-thin max-h-[200px] overflow-auto px-4 pb-2 font-mono text-sm">
            {response.headers.map(([name, value], index) => (
              <div className="flex gap-2 py-0.5" key={`${name}-${index}`}>
                <span className="text-muted-foreground">{name}</span>
                <span className="break-all">{value}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-sm text-muted-foreground">
          {statusBadge}
          No response headers
        </div>
      )}

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Response Body</p>
          {body !== "" && <CopyButton text={body} label="Copy response body" />}
        </div>
        {response.isBinary ? (
          <p className="text-sm text-muted-foreground">
            Binary response ({contentType ?? "unknown type"}, {formatSize(response.sizeBytes)}) — not displayed.
          </p>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-mono text-sm">{body}</pre>
        )}
      </div>
    </Card>
  );
}
