import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { formatBody, statusVariant } from "@/lib/requestTabs";
import type { HttpResponse } from "@/lib/http";

export function ResponseContainer({
  error,
  response,
}: {
  error: string | null;
  response: HttpResponse | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {error && (
        <Card className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-lg border border-destructive ring-0">
          <CardContent>
            <p className="mb-2 font-semibold text-destructive">Error</p>
            <pre className="whitespace-pre-wrap break-words font-mono text-sm text-destructive">
              {error}
            </pre>
          </CardContent>
        </Card>
      )}

      {response && (
        <Card className="flex min-h-0 flex-1 flex-col gap-0 rounded-lg border border-input py-0 ring-0">
          <div className="flex shrink-0 items-center border-b px-4 py-3">
            <Badge variant={statusVariant(response.status)} className="font-mono text-sm">
              {response.status}
            </Badge>
          </div>

          {Object.keys(response.headers).length > 0 && (
            <Collapsible className="shrink-0 border-b">
              <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Response Headers ({Object.keys(response.headers).length})
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="scrollbar-thin max-h-[200px] overflow-auto px-4 pb-2 font-mono text-sm">
                {Object.entries(response.headers).map(([name, value]) => (
                  <div className="flex gap-2 py-0.5" key={name}>
                    <span className="text-muted-foreground">{name}</span>
                    <span className="break-all">{value}</span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">Response Body</p>
            <pre className="whitespace-pre-wrap break-words font-mono text-sm">
              {formatBody(response.body)}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}
