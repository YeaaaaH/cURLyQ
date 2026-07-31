import { Card, CardContent } from "@/components/ui/card";

interface ResponseErrorProps {
  error: string;
}

export function ResponseError({ error }: ResponseErrorProps) {
  return (
    <Card className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border border-destructive ring-0">
      <CardContent>
        <p className="mb-2 font-semibold text-destructive">Error</p>
        <pre className="whitespace-pre-wrap break-words font-mono text-sm text-destructive">{error}</pre>
      </CardContent>
    </Card>
  );
}
