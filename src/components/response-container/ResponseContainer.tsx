import { Card } from "@/components/ui/card";
import { Send } from "lucide-react";
import type { HttpResponse } from "@/lib/http";
import { ResponseError } from "./ResponseError";
import { ResponseDetails } from "./ResponseDetails";

interface ResponseContainerProps {
  error: string | null;
  response: HttpResponse | null;
}

export function ResponseContainer({ error, response }: ResponseContainerProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {error && <ResponseError error={error} />}
      {response && <ResponseDetails response={response} />}
      {!error && !response && (
        <Card className="min-h-0 flex-1 items-center justify-center border border-input ring-0">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Send className="size-7" strokeWidth={1.5} />
            <p className="text-sm">Hit Send to get a response</p>
          </div>
        </Card>
      )}
    </div>
  );
}
