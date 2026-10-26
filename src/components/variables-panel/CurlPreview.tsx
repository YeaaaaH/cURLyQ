import { CopyButton } from "@/components/CopyButton";

interface CurlPreviewProps {
  curlCommand: string;
}

export function CurlPreview({ curlCommand }: CurlPreviewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex shrink-0 items-center justify-end">
        <CopyButton text={curlCommand} label="Copy cURL command" />
      </div>
      <pre className="scrollbar-thin min-h-0 flex-1 overflow-auto rounded-md border border-input bg-card p-2 font-mono text-xs whitespace-pre-wrap text-foreground">
        {curlCommand}
      </pre>
    </div>
  );
}
