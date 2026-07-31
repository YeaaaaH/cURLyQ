import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CurlPreviewProps {
  curlCommand: string;
}

export function CurlPreview({ curlCommand }: CurlPreviewProps) {
  function handleCopy() {
    navigator.clipboard.writeText(curlCommand);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex shrink-0 items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label="Copy cURL command"
          title="Copy"
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
      <pre className="scrollbar-thin min-h-0 flex-1 overflow-auto rounded-md border border-input bg-card p-2 font-mono text-xs whitespace-pre-wrap text-foreground">
        {curlCommand}
      </pre>
    </div>
  );
}
