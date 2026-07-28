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
    </div>
  );
}
